/**
 * Gestion des utilisateurs (liste, modification, suppression) depuis
 * /administration/utilisateurs. La création passe par un chemin distinct
 * (src/lib/auth/create-user.ts), car elle implique Better Auth (hachage du
 * mot de passe, création du compte "credential") — ce fichier-ci ne
 * manipule que la table `user` déjà existante, via Drizzle directement.
 *
 * Comme src/lib/auth/roles.ts, les garde-fous ci-dessous sont appliqués ICI,
 * pas seulement dans les Server Actions (src/app/actions/users.ts) : un
 * appel direct à ces fonctions ne peut pas les contourner.
 */
import { eq, sql } from "drizzle-orm";

import { db } from "@/db";
import { role, user } from "@/db/schema";
import { ADMIN_ROLE_ID } from "@/lib/auth/permissions";

export type UserListItem = {
  id: string;
  name: string;
  email: string;
  role: string;
  roleName: string;
  createdAt: Date;
};

/**
 * Liste tous les utilisateurs avec le nom d'affichage de leur rôle (jointure
 * sur `role`, plutôt qu'un aller-retour séparé par utilisateur).
 */
export async function listUsers(): Promise<UserListItem[]> {
  return db
    .select({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleName: role.name,
      createdAt: user.createdAt,
    })
    .from(user)
    .innerJoin(role, eq(user.role, role.id))
    .orderBy(user.name);
}

export type UserDetail = {
  id: string;
  name: string;
  email: string;
  role: string;
};

/**
 * Lit un utilisateur par identifiant, pour la page
 * /administration/utilisateurs/[id] (formulaire de modification) — mêmes
 * conventions que `getRole` dans src/lib/auth/roles.ts : `null` si absent,
 * plutôt qu'une erreur, pour laisser l'appelant décider de l'affichage
 * (« Utilisateur introuvable »). Pas de jointure sur `role` ici : le
 * formulaire d'édition reçoit déjà la liste complète des rôles (via
 * `listRoles()`) pour son sélecteur, il n'a pas besoin du nom d'affichage.
 */
export async function getUser(id: string): Promise<UserDetail | null> {
  const [row] = await db
    .select({ id: user.id, name: user.name, email: user.email, role: user.role })
    .from(user)
    .where(eq(user.id, id))
    .limit(1);
  return row ?? null;
}

/**
 * Compte les utilisateurs ayant le rôle "admin". Utilisée pour empêcher de
 * retirer le dernier accès administrateur de l'application (voir
 * `updateUser` et `deleteUser` ci-dessous).
 */
async function countAdmins(
  executor: Pick<typeof db, "select">,
): Promise<number> {
  const [row] = await executor
    .select({ count: sql<number>`count(*)::int` })
    .from(user)
    .where(eq(user.role, ADMIN_ROLE_ID));
  return row?.count ?? 0;
}

export type UpdateUserInput = {
  name?: string;
  role?: string;
};

/**
 * Met à jour le nom et/ou le rôle d'un utilisateur.
 *
 * Garde-fous (appliqués même si l'appelant — la Server Action — a déjà
 * vérifié la permission `user:update` du demandeur) :
 *   - un utilisateur ne peut pas changer son propre rôle (`actingUserId`
 *     === `id` et `role` fourni), pour éviter qu'il ne se verrouille
 *     lui-même hors de l'administration ;
 *   - si la cible a actuellement le rôle "admin" et que son rôle change
 *     vers autre chose, l'opération est refusée si elle est la DERNIÈRE
 *     admin — sans quoi l'application n'aurait plus aucun administrateur.
 *
 * La vérification du nombre d'admins et la mise à jour sont faites dans la
 * même transaction : suffisant pour ce contexte de back-office (pas de
 * verrou explicite), voir le commentaire équivalent dans `deleteUser`.
 */
export async function updateUser(
  actingUserId: string,
  id: string,
  input: UpdateUserInput,
): Promise<void> {
  if (input.role !== undefined && id === actingUserId) {
    throw new Error("Vous ne pouvez pas modifier votre propre rôle.");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    if (!target) {
      throw new Error("Cet utilisateur est introuvable.");
    }

    const patch: { name?: string; role?: string; updatedAt?: Date } = {};

    if (input.name !== undefined) {
      const name = input.name.trim();
      if (!name) {
        throw new Error("Le nom est requis.");
      }
      patch.name = name;
    }

    if (input.role !== undefined && input.role !== target.role) {
      const [roleRow] = await tx
        .select({ id: role.id })
        .from(role)
        .where(eq(role.id, input.role))
        .limit(1);
      if (!roleRow) {
        throw new Error("Ce rôle est introuvable.");
      }

      if (target.role === ADMIN_ROLE_ID) {
        const adminCount = await countAdmins(tx);
        if (adminCount <= 1) {
          throw new Error(
            "Impossible de retirer le rôle administrateur : c'est le dernier administrateur de l'application.",
          );
        }
      }

      patch.role = input.role;
    }

    if (Object.keys(patch).length === 0) return;

    patch.updatedAt = new Date();
    await tx.update(user).set(patch).where(eq(user.id, id));
  });
}

/**
 * Supprime un utilisateur. Un utilisateur ne peut pas se supprimer
 * lui-même, ni supprimer le dernier administrateur (mêmes raisons que
 * `updateUser` ci-dessus). Les sessions et comptes liés (tables `session` et
 * `account`) sont supprimés automatiquement par les contraintes ON DELETE
 * CASCADE déclarées dans src/db/schema.ts — pas besoin de les effacer
 * manuellement ici.
 */
export async function deleteUser(actingUserId: string, id: string): Promise<void> {
  if (id === actingUserId) {
    throw new Error("Vous ne pouvez pas supprimer votre propre compte.");
  }

  await db.transaction(async (tx) => {
    const [target] = await tx
      .select({ id: user.id, role: user.role })
      .from(user)
      .where(eq(user.id, id))
      .limit(1);
    if (!target) {
      throw new Error("Cet utilisateur est introuvable.");
    }

    if (target.role === ADMIN_ROLE_ID) {
      const adminCount = await countAdmins(tx);
      if (adminCount <= 1) {
        throw new Error(
          "Impossible de supprimer ce compte : c'est le dernier administrateur de l'application.",
        );
      }
    }

    await tx.delete(user).where(eq(user.id, id));
  });
}
