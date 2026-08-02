import { describe, expect, it } from "vitest"

import { slugify } from "@/lib/auth/roles"

// `slugify` est la seule logique pure de src/lib/auth/roles.ts (le reste
// parle à la base de données) — voir src/lib/auth/roles.integration.test.ts
// pour le CRUD complet des rôles.

describe("slugify", () => {
  it("met en minuscules et remplace les espaces par des tirets", () => {
    expect(slugify("Support Client")).toBe("support-client")
  })

  it("retire les accents", () => {
    expect(slugify("Comptabilité Générale")).toBe("comptabilite-generale")
  })

  it("remplace toute suite de caractères non alphanumériques par un seul tiret", () => {
    expect(slugify("Ventes & Marketing !!!")).toBe("ventes-marketing")
  })

  it("retire les tirets en début et fin de chaîne", () => {
    expect(slugify("  -Support-  ")).toBe("support")
  })

  it("retourne une chaîne vide pour un nom sans caractère alphanumérique", () => {
    expect(slugify("!!!")).toBe("")
  })
})
