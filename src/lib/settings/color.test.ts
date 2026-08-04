import { describe, expect, it } from "vitest"

import {
  buildThemeCssVariables,
  darkModeVariant,
  hexToRgb,
  isValidHexColor,
  readableForeground,
  rgbToHsl,
} from "@/lib/settings/color"

// Fonctions pures, aucune base de données nécessaire — voir le commentaire
// en tête de src/lib/settings/color.ts.

describe("isValidHexColor", () => {
  it("accepte un #RRGGBB en minuscules", () => {
    expect(isValidHexColor("#1e3a8a")).toBe(true)
  })

  it("accepte un #RRGGBB en majuscules ou casse mixte", () => {
    expect(isValidHexColor("#FACC15")).toBe(true)
    expect(isValidHexColor("#FaCc15")).toBe(true)
  })

  it("rejette la forme courte #RGB", () => {
    expect(isValidHexColor("#fff")).toBe(false)
  })

  it("rejette un canal alpha (#RRGGBBAA)", () => {
    expect(isValidHexColor("#ffffffaa")).toBe(false)
  })

  it("rejette une chaîne sans dièse", () => {
    expect(isValidHexColor("ffffff")).toBe(false)
  })

  it("rejette des caractères hors hexadécimal", () => {
    expect(isValidHexColor("#gggggg")).toBe(false)
  })

  it("rejette une chaîne vide", () => {
    expect(isValidHexColor("")).toBe(false)
  })

  it("rejette un nombre incorrect de chiffres", () => {
    expect(isValidHexColor("#12345")).toBe(false)
    expect(isValidHexColor("#1234567")).toBe(false)
  })
})

describe("hexToRgb", () => {
  it("décompose le rouge pur", () => {
    expect(hexToRgb("#ff0000")).toEqual({ r: 255, g: 0, b: 0 })
  })

  it("décompose le noir et le blanc", () => {
    expect(hexToRgb("#000000")).toEqual({ r: 0, g: 0, b: 0 })
    expect(hexToRgb("#ffffff")).toEqual({ r: 255, g: 255, b: 255 })
  })

  it("est insensible à la casse", () => {
    expect(hexToRgb("#FACC15")).toEqual(hexToRgb("#facc15"))
  })
})

describe("rgbToHsl", () => {
  it("rouge pur → teinte 0, saturation 100%, luminosité 50%", () => {
    const { h, s, l } = rgbToHsl({ r: 255, g: 0, b: 0 })
    expect(h).toBeCloseTo(0, 0)
    expect(s).toBeCloseTo(100, 0)
    expect(l).toBeCloseTo(50, 0)
  })

  it("vert pur → teinte 120°", () => {
    expect(rgbToHsl({ r: 0, g: 255, b: 0 }).h).toBeCloseTo(120, 0)
  })

  it("bleu pur → teinte 240°", () => {
    expect(rgbToHsl({ r: 0, g: 0, b: 255 }).h).toBeCloseTo(240, 0)
  })

  it("gris → saturation nulle (couleur achromatique)", () => {
    const { h, s, l } = rgbToHsl({ r: 128, g: 128, b: 128 })
    expect(s).toBe(0)
    expect(h).toBe(0)
    expect(l).toBeCloseTo(50, 0)
  })
})

describe("readableForeground", () => {
  it("jaune (#facc15) → texte sombre (quasi noir)", () => {
    expect(readableForeground("#facc15")).toBe("oklch(0.205 0 0)")
  })

  it("bleu marine (#1e3a8a) → texte clair (quasi blanc)", () => {
    expect(readableForeground("#1e3a8a")).toBe("oklch(0.985 0 0)")
  })

  it("blanc → texte sombre", () => {
    expect(readableForeground("#ffffff")).toBe("oklch(0.205 0 0)")
  })

  it("noir → texte clair", () => {
    expect(readableForeground("#000000")).toBe("oklch(0.985 0 0)")
  })
})

describe("darkModeVariant", () => {
  it("relève la luminosité d'une couleur sombre pour rester visible en mode sombre", () => {
    const hex = "#1e3a8a" // bleu marine, luminosité HSL d'origine ≈ 33%
    const originalLightness = rgbToHsl(hexToRgb(hex)).l
    expect(originalLightness).toBeLessThan(55)

    const variant = darkModeVariant(hex)
    const match = variant.match(/^hsl\((\d+) (\d+)% (\d+)%\)$/)
    expect(match).not.toBeNull()
    const lightness = Number(match?.[3])
    expect(lightness).toBeGreaterThanOrEqual(55)
  })

  it("ne modifie pas une couleur déjà assez claire", () => {
    const hex = "#93c5fd" // bleu clair, luminosité HSL d'origine > 55%
    const original = rgbToHsl(hexToRgb(hex))
    expect(original.l).toBeGreaterThanOrEqual(55)

    const variant = darkModeVariant(hex)
    const expected = `hsl(${Math.round(original.h)} ${Math.round(original.s)}% ${Math.round(original.l)}%)`
    expect(variant).toBe(expected)
  })

  it("conserve la teinte et la saturation d'origine", () => {
    const hex = "#1e3a8a"
    const original = rgbToHsl(hexToRgb(hex))
    const variant = darkModeVariant(hex)
    const match = variant.match(/^hsl\((\d+) (\d+)% (\d+)%\)$/)
    expect(Number(match?.[1])).toBeCloseTo(original.h, 0)
    expect(Number(match?.[2])).toBeCloseTo(original.s, 0)
  })
})

describe("buildThemeCssVariables", () => {
  const REQUIRED_KEYS = [
    "--primary",
    "--primary-foreground",
    "--ring",
    "--sidebar-primary",
    "--sidebar-primary-foreground",
    "--sidebar-ring",
    "--sidebar-accent",
    "--sidebar-accent-foreground",
  ] as const

  it("retourne les six variables attendues pour le clair et le sombre", () => {
    const { light, dark } = buildThemeCssVariables("#2563eb")
    for (const key of REQUIRED_KEYS) {
      expect(light).toHaveProperty(key)
      expect(dark).toHaveProperty(key)
      expect(typeof light[key]).toBe("string")
      expect(typeof dark[key]).toBe("string")
    }
  })

  it("le mode clair utilise directement le hex fourni pour primary/ring/sidebar-primary/sidebar-ring/sidebar-accent", () => {
    const hex = "#2563eb"
    const { light } = buildThemeCssVariables(hex)
    expect(light["--primary"]).toBe(hex)
    expect(light["--ring"]).toBe(hex)
    expect(light["--sidebar-primary"]).toBe(hex)
    expect(light["--sidebar-ring"]).toBe(hex)
    expect(light["--sidebar-accent"]).toBe(hex)
  })

  it("le mode sombre utilise la variante assombrie (darkModeVariant) pour primary/ring/sidebar-primary/sidebar-ring/sidebar-accent", () => {
    const hex = "#1e3a8a"
    const { dark } = buildThemeCssVariables(hex)
    const expected = darkModeVariant(hex)
    expect(dark["--primary"]).toBe(expected)
    expect(dark["--ring"]).toBe(expected)
    expect(dark["--sidebar-primary"]).toBe(expected)
    expect(dark["--sidebar-ring"]).toBe(expected)
    expect(dark["--sidebar-accent"]).toBe(expected)
  })

  it("primary-foreground, sidebar-primary-foreground et sidebar-accent-foreground sont identiques dans chaque mode", () => {
    const { light, dark } = buildThemeCssVariables("#facc15")
    expect(light["--sidebar-primary-foreground"]).toBe(light["--primary-foreground"])
    expect(dark["--sidebar-primary-foreground"]).toBe(dark["--primary-foreground"])
    expect(light["--sidebar-accent-foreground"]).toBe(light["--primary-foreground"])
    expect(dark["--sidebar-accent-foreground"]).toBe(dark["--primary-foreground"])
  })

  it("--sidebar-accent est ce qui pilote réellement l'élément actif de la barre latérale dans ce projet (voir src/components/ui/sidebar.tsx)", () => {
    // Non-régression du choix documenté dans buildThemeCssVariables : si ce
    // test casse un jour parce que `--sidebar-accent` a été retiré du
    // résultat, vérifier d'abord si src/components/ui/sidebar.tsx utilise
    // encore `data-active:bg-sidebar-accent` avant de le supprimer d'ici.
    const { light, dark } = buildThemeCssVariables("#16a34a")
    expect(light["--sidebar-accent"]).toBe(light["--primary"])
    expect(dark["--sidebar-accent"]).toBe(dark["--primary"])
  })

  it("jaune : texte sombre en mode clair", () => {
    const { light } = buildThemeCssVariables("#facc15")
    expect(light["--primary-foreground"]).toBe("oklch(0.205 0 0)")
  })
})
