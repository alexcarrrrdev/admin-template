import { z } from "zod"

// Schémas Zod du profil utilisateur (page /profil), partagés entre le
// client (validation immédiate dans le formulaire) et le serveur (Server
// Actions dans src/app/actions/profile.ts), comme src/lib/schemas/auth.ts.

export const updateNameSchema = z.object({
  name: z.string().trim().min(1, { error: "Le nom est requis." }),
})

export type UpdateNameInput = z.infer<typeof updateNameSchema>

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, { error: "Le mot de passe actuel est requis." }),
    newPassword: z
      .string()
      .min(8, { error: "Le nouveau mot de passe doit contenir au moins 8 caractères." }),
    confirmPassword: z.string(),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    error: "Les mots de passe ne correspondent pas.",
    path: ["confirmPassword"],
  })

export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
