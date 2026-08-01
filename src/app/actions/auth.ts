"use server"

import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import {
  forgotPasswordSchema,
  loginSchema,
  resetPasswordSchema,
  type ForgotPasswordInput,
  type LoginInput,
  type ResetPasswordInput,
} from "@/lib/schemas/auth"

type ActionResult = { error?: string }

// Server Actions d'authentification. Elles revalident les données avec les
// mêmes schémas Zod que les formulaires (src/lib/schemas/auth.ts) avant
// d'appeler l'API serveur de Better Auth — la validation ne repose donc pas
// uniquement sur le client.

export async function loginAction(values: LoginInput): Promise<ActionResult> {
  const parsed = loginSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Courriel ou mot de passe invalide." }
  }

  try {
    await auth.api.signInEmail({
      body: parsed.data,
      headers: await headers(),
    })
  } catch {
    return { error: "Courriel ou mot de passe invalide." }
  }

  redirect("/tableau-de-bord")
}

export async function forgotPasswordAction(
  values: ForgotPasswordInput,
): Promise<void> {
  const parsed = forgotPasswordSchema.safeParse(values)
  if (!parsed.success) return

  try {
    await auth.api.requestPasswordReset({
      body: {
        email: parsed.data.email,
        redirectTo: "/reinitialiser-mot-de-passe",
      },
      headers: await headers(),
    })
  } catch {
    // Volontairement ignoré : la page affiche toujours le même message
    // neutre, qu'un compte existe ou non, pour éviter l'énumération de
    // comptes par courriel.
  }
}

export async function resetPasswordAction(
  values: ResetPasswordInput,
  token: string | undefined,
): Promise<ActionResult> {
  if (!token) {
    return { error: "Ce lien de réinitialisation est invalide ou a expiré." }
  }

  const parsed = resetPasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Les mots de passe ne correspondent pas." }
  }

  try {
    await auth.api.resetPassword({
      body: { newPassword: parsed.data.password, token },
      headers: await headers(),
    })
  } catch {
    return { error: "Ce lien de réinitialisation est invalide ou a expiré." }
  }

  redirect("/")
}
