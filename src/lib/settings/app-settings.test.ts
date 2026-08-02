import { describe, expect, it } from "vitest"

import {
  DEFAULT_APP_NAME,
  canManageAppSettings,
  resolveAppName,
} from "@/lib/settings/app-settings"

// Ces tests couvrent la logique pure (repli par défaut, permission), sans
// toucher à la base de données — voir src/lib/settings/app-settings.integration.test.ts
// pour la persistance réelle (lecture/écriture en Postgres).

describe("resolveAppName", () => {
  it("retombe sur le nom par défaut quand aucune rangée n'existe", () => {
    expect(resolveAppName(undefined)).toBe(DEFAULT_APP_NAME)
    expect(resolveAppName(null)).toBe(DEFAULT_APP_NAME)
  })

  it("retourne le nom enregistré quand une rangée existe", () => {
    expect(resolveAppName({ appName: "Acme Corp" })).toBe("Acme Corp")
  })
})

describe("canManageAppSettings", () => {
  it("autorise un administrateur", () => {
    expect(canManageAppSettings({ role: "admin" })).toBe(true)
  })

  it("refuse un membre", () => {
    expect(canManageAppSettings({ role: "member" })).toBe(false)
  })

  it("refuse un utilisateur absent", () => {
    expect(canManageAppSettings(null)).toBe(false)
    expect(canManageAppSettings(undefined)).toBe(false)
  })
})
