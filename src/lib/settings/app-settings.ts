import { cache } from "react"
import { eq } from "drizzle-orm"

import { db } from "@/db"
import { appSettings } from "@/db/schema"
import { hasPermission } from "@/lib/auth/permissions"

// Nom de l'application par défaut, utilisé tant qu'aucun administrateur n'a
// enregistré de nom personnalisé (voir /administration/general).
export const DEFAULT_APP_NAME = "Admin Template"

// Identifiant fixe de l'unique rangée de app_settings : garantit qu'il ne
// peut jamais en exister plus d'une (voir src/db/schema.ts).
export const APP_SETTINGS_ID = "singleton"

/**
 * Résout le nom de l'application à partir de la rangée lue en base (ou son
 * absence). Extrait dans une fonction pure séparée de `getAppName` pour
 * pouvoir tester la logique de repli sans base de données.
 */
export function resolveAppName(row: { appName: string } | undefined | null): string {
  return row?.appName ?? DEFAULT_APP_NAME
}

/**
 * Lit le nom de l'application.
 *
 * Mémorisé avec `cache()` de React : le nom est lu à plusieurs endroits d'un
 * même rendu (métadonnées de la racine, en-tête de la barre latérale, page
 * /administration/general), et sans cette mémorisation chaque endroit
 * déclencherait sa propre requête. La mémorisation ne vaut que pour la durée
 * d'une requête HTTP : une écriture suivie d'un rafraîchissement (nouvelle
 * requête) renvoie bien la valeur à jour.
 */
export const getAppName = cache(async function getAppName(): Promise<string> {
  const [row] = await db
    .select({ appName: appSettings.appName })
    .from(appSettings)
    .where(eq(appSettings.id, APP_SETTINGS_ID))
    .limit(1)

  return resolveAppName(row)
})

/**
 * Enregistre le nom de l'application. Crée la rangée si elle n'existe pas
 * encore (premier enregistrement), sinon la met à jour.
 */
export async function setAppName(appName: string): Promise<void> {
  await db
    .insert(appSettings)
    .values({ id: APP_SETTINGS_ID, appName })
    .onConflictDoUpdate({
      target: appSettings.id,
      set: { appName, updatedAt: new Date() },
    })
}

type SessionUser = { role?: string | null } | null | undefined

/**
 * Un utilisateur peut gérer les paramètres de l'application (page
 * /administration/general) s'il a la permission `settings:update` — plus
 * stricte que `settings:read`, qui ne contrôle que la visibilité du lien
 * dans la barre latérale (voir src/components/app-sidebar.tsx).
 */
export function canManageAppSettings(user: SessionUser): boolean {
  return hasPermission(user, "settings", "update")
}
