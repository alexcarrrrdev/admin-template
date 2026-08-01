import { describe, expect, it } from "vitest"

import { hasPermission, requirePermission, statement } from "@/lib/permissions"

const admin = { role: "admin" }
const member = { role: "member" }

describe("hasPermission", () => {
  it("accorde à l'administrateur toutes les permissions du statement", () => {
    expect(hasPermission(admin, "user", "create")).toBe(true)
    expect(hasPermission(admin, "user", "read")).toBe(true)
    expect(hasPermission(admin, "user", "update")).toBe(true)
    expect(hasPermission(admin, "user", "delete")).toBe(true)
    expect(hasPermission(admin, "settings", "read")).toBe(true)
    expect(hasPermission(admin, "settings", "update")).toBe(true)
  })

  it("couvre bien toutes les ressources et actions déclarées dans le statement", () => {
    // Garde-fou : si une ressource ou une action est ajoutée à `statement`
    // sans que ce test soit mis à jour, ce test échoue plutôt que de laisser
    // une nouvelle permission non couverte passer inaperçue.
    expect(Object.keys(statement).sort()).toEqual(["settings", "user"])
    expect([...statement.user].sort()).toEqual([
      "create",
      "delete",
      "read",
      "update",
    ])
    expect([...statement.settings].sort()).toEqual(["read", "update"])
  })

  it("limite le membre à la lecture", () => {
    expect(hasPermission(member, "user", "read")).toBe(true)
    expect(hasPermission(member, "settings", "read")).toBe(true)

    expect(hasPermission(member, "user", "create")).toBe(false)
    expect(hasPermission(member, "user", "update")).toBe(false)
    expect(hasPermission(member, "user", "delete")).toBe(false)
    expect(hasPermission(member, "settings", "update")).toBe(false)
  })

  it("retourne false pour un rôle inconnu", () => {
    expect(hasPermission({ role: "superadmin" }, "user", "read")).toBe(false)
  })

  it("retourne false pour un utilisateur absent (null ou undefined)", () => {
    expect(hasPermission(null, "user", "read")).toBe(false)
    expect(hasPermission(undefined, "user", "read")).toBe(false)
  })
})

describe("requirePermission", () => {
  it("ne lance pas d'erreur quand la permission est accordée", () => {
    expect(() => requirePermission(admin, "user", "create")).not.toThrow()
  })

  it("lance une erreur en français quand la permission est refusée", () => {
    expect(() => requirePermission(member, "user", "create")).toThrow(
      /permission refusée/i,
    )
  })

  it("lance une erreur pour un utilisateur absent", () => {
    expect(() => requirePermission(null, "settings", "update")).toThrow(
      /permission refusée/i,
    )
  })
})
