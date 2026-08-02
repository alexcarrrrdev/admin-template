/**
 * Création d'un utilisateur avec mot de passe, en passant par l'adaptateur
 * interne de Better Auth (context.internalAdapter + context.password.hash)
 * plutôt que par l'API HTTP publique — qui refuse toute inscription (voir
 * emailAndPassword.disableSignUp dans src/lib/auth/index.ts). C'est le seul
 * moyen de créer un compte pour ce template.
 *
 * Extrait de scripts/create-admin.ts (qui l'utilise pour le tout premier
 * compte administrateur) pour être réutilisé par createUserAction
 * (src/app/actions/users.ts), qui crée les comptes suivants depuis
 * /administration/utilisateurs.
 */
import { auth } from "@/lib/auth";
import { getRole } from "@/lib/auth/roles";

export type CreateUserWithPasswordInput = {
  name: string;
  email: string;
  password: string;
  role: string;
};

export type CreatedUser = {
  id: string;
  name: string;
  email: string;
  role: string;
};

export async function createUserWithPassword(
  input: CreateUserWithPasswordInput,
): Promise<CreatedUser> {
  const name = input.name.trim();
  const email = input.email.trim().toLowerCase();

  const role = await getRole(input.role);
  if (!role) {
    throw new Error(`Le rôle « ${input.role} » est introuvable.`);
  }

  const context = await auth.$context;

  const existing = await context.internalAdapter.findUserByEmail(email);
  if (existing) {
    throw new Error(`Un compte existe déjà avec le courriel « ${email} ».`);
  }

  const hashedPassword = await context.password.hash(input.password);

  const createdUser = await context.internalAdapter.createUser({
    name,
    email,
    emailVerified: true,
    role: role.id,
  });

  await context.internalAdapter.linkAccount({
    userId: createdUser.id,
    providerId: "credential",
    accountId: createdUser.id,
    password: hashedPassword,
  });

  return { id: createdUser.id, name: createdUser.name, email: createdUser.email, role: role.id };
}
