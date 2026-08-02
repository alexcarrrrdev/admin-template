"use server"

import { headers } from "next/headers"

import { auth } from "@/lib/auth"
import {
  canManageAppSettings,
  clearLogo,
  setAppName,
  setLogo,
} from "@/lib/settings/app-settings"
import { validateLogoFile } from "@/lib/settings/logo-validation"
import {
  updateAppNameSchema,
  type UpdateAppNameInput,
} from "@/lib/settings/schemas"

type ActionResult = { error?: string }

// Vérification de permission commune aux trois actions de ce fichier :
// refaite systématiquement côté serveur, jamais déduite de l'UI (voir la
// documentation en tête de chaque action ci-dessous).
async function requireAppSettingsSession() {
  const session = await auth.api.getSession({ headers: await headers() })
  if (!session || !(await canManageAppSettings(session.user))) {
    return null
  }
  return session
}

// Server Action de la page /administration/general. La vérification de
// permission est refaite ici même si le menu et la page filtrent déjà
// l'accès : cette action ne doit jamais se fier uniquement à l'UI.
export async function updateAppNameAction(
  values: UpdateAppNameInput,
): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
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

// Server Action d'upload du logo. Reçoit un FormData (pas un objet
// typé/validé côté client) car c'est la façon standard d'envoyer un fichier
// à une Server Action — voir node_modules/next/dist/docs/01-app/02-guides/
// server-actions.md : « Validate inputs. Treat FormData [...] as untrusted. »
// La validation elle-même (taille, type MIME, signature binaire, liste noire
// SVG) est déléguée à validateLogoFile, testée indépendamment — voir
// src/lib/settings/logo-validation.test.ts.
export async function uploadLogoAction(formData: FormData): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  const file = formData.get("logo")
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Aucun fichier n'a été sélectionné." }
  }

  const bytes = new Uint8Array(await file.arrayBuffer())
  const validation = validateLogoFile(bytes, file.type)
  if (!validation.valid) {
    return { error: validation.error }
  }

  try {
    await setLogo(Buffer.from(bytes), file.type)
  } catch {
    return { error: "Une erreur est survenue lors de l'enregistrement du logo." }
  }

  return {}
}

// Server Action de retrait du logo : fait retomber l'application sur l'icône
// par défaut (voir src/components/brand-mark.tsx).
export async function removeLogoAction(): Promise<ActionResult> {
  const session = await requireAppSettingsSession()
  if (!session) {
    return {
      error: "Vous n'avez pas la permission de modifier ces paramètres.",
    }
  }

  try {
    await clearLogo()
  } catch {
    return { error: "Une erreur est survenue lors du retrait du logo." }
  }

  return {}
}
