/**
 * Modèle de permissions granulaires (ressource × action), basé sur le module
 * d'access control de Better Auth (`better-auth/plugins/access`).
 *
 * Comment ajouter une ressource :
 *   1. Ajouter une entrée à `statement` ci-dessous avec la liste de ses actions.
 *   2. Donner (ou non) accès à cette ressource dans chaque rôle plus bas.
 *
 * Comment ajouter un rôle :
 *   1. Ajouter un nouvel objet dans `roles` via `accessControl.newRole({...})`.
 *   2. Ajouter son libellé français dans `roleLabels`.
 *   3. S'assurer que la valeur stockée dans la colonne `role` de la table
 *      `user` (src/db/schema.ts) correspond à la clé du rôle.
 */
import { createAccessControl } from "better-auth/plugins/access";

// Statement : liste des ressources et des actions possibles sur chacune.
// Gardé volontairement petit pour ce template, mais facile à étendre.
export const statement = {
  user: ["create", "read", "update", "delete"],
  settings: ["read", "update"],
} as const;

const accessControl = createAccessControl(statement);

export const roles = {
  // L'administrateur a accès à tout.
  admin: accessControl.newRole({
    user: ["create", "read", "update", "delete"],
    settings: ["read", "update"],
  }),
  // Le membre a un accès en lecture seule, sensé par défaut.
  member: accessControl.newRole({
    user: ["read"],
    settings: ["read"],
  }),
};

export type Role = keyof typeof roles;

// Libellés français des rôles, pour une future UI d'administration.
export const roleLabels: Record<Role, string> = {
  admin: "Administrateur",
  member: "Membre",
};

export type Resource = keyof typeof statement;
export type Action<R extends Resource> = (typeof statement)[R][number];

type SessionUser = { role?: string | null } | null | undefined;

function isKnownRole(role: string | null | undefined): role is Role {
  return !!role && role in roles;
}

/**
 * Vérifie si un utilisateur possède la permission demandée sur une ressource.
 * Retourne `false` (plutôt que de lancer une erreur) si l'utilisateur est
 * absent ou si son rôle est inconnu.
 */
export function hasPermission<R extends Resource>(
  user: SessionUser,
  resource: R,
  action: Action<R>,
): boolean {
  if (!isKnownRole(user?.role)) return false;

  const result = roles[user.role].authorize({
    [resource]: [action],
  } as Parameters<(typeof roles)[Role]["authorize"]>[0]);

  return result.success;
}

/**
 * Variante « stricte » de `hasPermission`, destinée aux Server Actions et
 * Route Handlers : lance une erreur si la permission est manquante, ce qui
 * interrompt l'exécution de l'action en cours.
 */
export function requirePermission<R extends Resource>(
  user: SessionUser,
  resource: R,
  action: Action<R>,
): void {
  if (!hasPermission(user, resource, action)) {
    throw new Error(
      `Permission refusée : l'action « ${action} » sur « ${resource} » requiert des droits supplémentaires.`,
    );
  }
}
