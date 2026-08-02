"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import { canManageAppSettings, setAppName } from "@/lib/app-settings"
import {
  updateAppNameSchema,
  type UpdateAppNameInput,
} from "@/lib/schemas/app-settings"

type ActionResult = { error?: string }

// Server Action de la page /administration/general. La vérification de
// permission est refaite ici même si le menu et la page filtrent déjà
// l'accès : cette action ne doit jamais se fier uniquement à l'UI.
export async function updateAppNameAction(
  values: UpdateAppNameInput,
): Promise<ActionResult> {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !canManageAppSettings(session.user)) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  const parsed = updateAppNameSchema.safeParse(values)
  if (!parsed.success) {
    return {
      error: parsed.error.issues[0]?.message ?? "Nom de l'application invalide.",
    }
  }

  try {
    await setAppName(parsed.data.appName)
  } catch {
    return { error: "Une erreur est survenue lors de l'enregistrement." }
  }

  return {}
}
