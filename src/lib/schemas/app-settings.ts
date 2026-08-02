import { z } from "zod"

// Schéma Zod des paramètres de l'application (page
// /administration/general), partagé entre le client et le serveur (Server
// Action dans src/app/actions/app-settings.ts).

export const updateAppNameSchema = z.object({
  appName: z
    .string()
    .trim()
    .min(1, { error: "Le nom de l'application est requis." })
    .max(100, {
      error: "Le nom de l'application est trop long (100 caractères maximum).",
    }),
})

export type UpdateAppNameInput = z.infer<typeof updateAppNameSchema>
