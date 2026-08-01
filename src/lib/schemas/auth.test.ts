import { describe, expect, it } from "vitest"

import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
} from "@/lib/schemas/auth"

describe("loginSchema", () => {
  it("accepte un courriel et un mot de passe valides", () => {
    const result = loginSchema.safeParse({
      email: "alex@exemple.com",
      password: "un-mot-de-passe",
    })
    expect(result.success).toBe(true)
  })

  it("rejette un courriel invalide", () => {
    const result = loginSchema.safeParse({
      email: "pas-un-courriel",
      password: "un-mot-de-passe",
    })
    expect(result.success).toBe(false)
  })

  it("rejette un mot de passe vide", () => {
    const result = loginSchema.safeParse({
      email: "alex@exemple.com",
      password: "",
    })
    expect(result.success).toBe(false)
  })
})

describe("forgotPasswordSchema", () => {
  it("accepte un courriel valide", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "alex@exemple.com" }).success,
    ).toBe(true)
  })

  it("rejette un courriel invalide", () => {
    expect(
      forgotPasswordSchema.safeParse({ email: "pas-un-courriel" }).success,
    ).toBe(false)
  })
})

describe("resetPasswordSchema", () => {
  it("accepte deux mots de passe identiques d'au moins 8 caractères", () => {
    const result = resetPasswordSchema.safeParse({
      password: "motdepasse123",
      confirmPassword: "motdepasse123",
    })
    expect(result.success).toBe(true)
  })

  it("rejette un mot de passe de moins de 8 caractères", () => {
    const result = resetPasswordSchema.safeParse({
      password: "court1",
      confirmPassword: "court1",
    })
    expect(result.success).toBe(false)
  })

  it("rejette une confirmation qui ne correspond pas au mot de passe", () => {
    const result = resetPasswordSchema.safeParse({
      password: "motdepasse123",
      confirmPassword: "autrechose123",
    })
    expect(result.success).toBe(false)
    if (!result.success) {
      const confirmError = result.error.issues.find((issue) =>
        issue.path.includes("confirmPassword"),
      )
      expect(confirmError).toBeDefined()
    }
  })
})
