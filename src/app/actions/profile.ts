"use server"

import { headers } from "next/headers"
import { APIError } from "better-auth"

import { auth } from "@/lib/auth"
import {
  changePasswordSchema,
  updateNameSchema,
  type ChangePasswordInput,
  type UpdateNameInput,
} from "@/lib/auth/schemas"

type ActionResult = { error?: string }

// Server Actions de la page /profil. Comme src/app/actions/auth.ts, elles
// revalident avec les mêmes schémas Zod que les formulaires avant d'appeler
// l'API serveur de Better Auth.

export async function updateNameAction(
  values: UpdateNameInput,
): Promise<ActionResult> {
  const parsed = updateNameSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Le nom est requis." }
  }

  try {
    await auth.api.updateUser({
      body: { name: parsed.data.name },
      headers: await headers(),
    })
  } catch {
    return { error: "Une erreur est survenue. Réessayez plus tard." }
  }

  return {}
}

export async function changePasswordAction(
  values: ChangePasswordInput,
): Promise<ActionResult> {
  const parsed = changePasswordSchema.safeParse(values)
  if (!parsed.success) {
    return { error: "Les mots de passe saisis sont invalides." }
  }

  try {
    await auth.api.changePassword({
      body: {
        currentPassword: parsed.data.currentPassword,
        newPassword: parsed.data.newPassword,
        // Exigence de sécurité : une session volée ne doit pas survivre à un
        // changement de mot de passe. Better Auth révoque alors toutes les
        // sessions existantes et en recrée une nouvelle pour la session
        // courante (voir node_modules/better-auth/dist/api/routes/update-user.mjs).
        revokeOtherSessions: true,
      },
      headers: await headers(),
    })
  } catch (error) {
    if (error instanceof APIError && error.body?.code === "INVALID_PASSWORD") {
      return { error: "Le mot de passe actuel est incorrect." }
    }
    return { error: "Une erreur est survenue. Réessayez plus tard." }
  }

  return {}
}

export async function revokeSessionAction(token: string): Promise<ActionResult> {
  if (!token) {
    return { error: "Session invalide." }
  }

  const session = await auth.api.getSession({ headers: await headers() })
  if (!session) {
    return { error: "Votre session a expiré. Reconnectez-vous." }
  }

  // Défense en profondeur : l'utilisateur ne doit jamais pouvoir se
  // déconnecter lui-même depuis cette action (le bouton « Révoquer » n'est
  // déjà pas affiché pour la session courante côté client).
  if (session.session.token === token) {
    return {
      error: "Vous ne pouvez pas révoquer votre session actuelle depuis cette page.",
    }
  }

  try {
    await auth.api.revokeSession({
      body: { token },
      headers: await headers(),
    })
  } catch {
    return { error: "Impossible de révoquer cette session." }
  }

  return {}
}

export async function revokeOtherSessionsAction(): Promise<ActionResult> {
  try {
    await auth.api.revokeOtherSessions({ headers: await headers() })
  } catch {
    return { error: "Impossible de déconnecter les autres sessions." }
  }

  return {}
}
