import { randomUUID } from "node:crypto"
import { sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// Tests d'intégration : contrairement aux autres tests (project "node" /
// "jsdom"), ceux-ci parlent à un vrai Postgres local (voir DATABASE_URL dans
// .env, port 5433 par défaut avec le docker-compose.yml fourni) au travers
// de l'API serveur de Better Auth (src/lib/auth.ts) — pas via HTTP.
//
// Ils ne sont exécutés que par `npm run test:integration` (voir
// vitest.config.mts : project "integration", exclu de `npm test`), car ils
// nécessitent Postgres démarré.
//
// .env doit être chargé AVANT que src/db (et donc src/lib/auth) ne soit
// importé, car src/db/index.ts lit DATABASE_URL au moment de l'import pour
// créer le pool de connexions. Comme scripts/create-admin.ts, on charge donc
// .env ici puis on importe dynamiquement les modules concernés.

type AuthModule = typeof import("@/lib/auth")
type DbModule = typeof import("@/db")

let auth: AuthModule["auth"]
let db: DbModule["db"]

// Comptes créés par les tests de ce fichier, à supprimer après coup. Chaque
// test crée son propre utilisateur avec un courriel unique (voir
// `uniqueEmail`) et l'empile ici ; `afterEach` vide la pile. Ça permet à la
// suite d'être rejouable indéfiniment sans jamais toucher aux comptes
// préexistants (ex. le vrai compte de développement alex@alexcaron.ca).
const createdUserIds: string[] = []

function uniqueEmail(label: string) {
  return `test-integration-${label}-${Date.now()}-${randomUUID().slice(0, 8)}@example.test`
}

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé (ex. variables déjà fournies par
    // l'environnement) : on continue avec l'environnement existant, comme
    // scripts/create-admin.ts.
  }

  const [authModule, dbModule] = await Promise.all([
    import("@/lib/auth"),
    import("@/db"),
  ])
  auth = authModule.auth
  db = dbModule.db

  try {
    await db.execute(sql`select 1`)
  } catch (cause) {
    throw new Error(
      "Impossible de se connecter à PostgreSQL (voir DATABASE_URL dans .env, " +
        "port 5433 par défaut). Démarrez la base avec « docker compose up -d », " +
        "ou lancez seulement les tests qui n'en ont pas besoin avec " +
        "« npm run test:unit ».",
      { cause: cause as Error },
    )
  }
}, 20_000)

afterEach(async () => {
  if (!auth) return
  const context = await auth.$context
  while (createdUserIds.length > 0) {
    const id = createdUserIds.pop()
    if (id) await context.internalAdapter.deleteUser(id)
  }
})

/**
 * Crée un utilisateur de test en passant par le même chemin interne que
 * scripts/create-admin.ts (context.internalAdapter + context.password.hash),
 * plutôt que par l'API HTTP publique — qui refuse toute inscription
 * (voir emailAndPassword.disableSignUp dans src/lib/auth.ts).
 */
async function createTestUser(
  label: string,
  password: string,
  role: "admin" | "member" = "member",
) {
  const context = await auth.$context
  const email = uniqueEmail(label)
  const hashedPassword = await context.password.hash(password)

  const user = await context.internalAdapter.createUser({
    name: `Utilisateur de test (${label})`,
    email,
    emailVerified: true,
    role,
  })
  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashedPassword,
  })

  createdUserIds.push(user.id)
  return { ...user, password }
}

describe("Better Auth — intégration Postgres", () => {
  it("signInEmail réussit avec le bon mot de passe", async () => {
    const user = await createTestUser("signin-ok", "MotDePasse123!")

    const result = await auth.api.signInEmail({
      body: { email: user.email, password: user.password },
      headers: new Headers(),
    })

    expect(result.user.email).toBe(user.email)
    expect(result.token).toBeTruthy()
  })

  it("signInEmail échoue avec un mauvais mot de passe", async () => {
    const user = await createTestUser("signin-bad", "MotDePasse123!")

    await expect(
      auth.api.signInEmail({
        body: { email: user.email, password: "un-tout-autre-mot-de-passe" },
        headers: new Headers(),
      }),
    ).rejects.toThrow()
  })

  it("signUpEmail est refusé car l'inscription publique est désactivée", async () => {
    const email = uniqueEmail("signup-refused")

    await expect(
      auth.api.signUpEmail({
        body: {
          name: "Ne devrait jamais être créé",
          email,
          password: "MotDePasse123!",
        },
        headers: new Headers(),
      }),
    ).rejects.toThrow()

    // Vérifie qu'aucun compte n'a été créé malgré tout.
    const context = await auth.$context
    const found = await context.internalAdapter.findUserByEmail(email)
    expect(found).toBeFalsy()
  })

  it("une demande de réinitialisation pour un courriel inconnu ne lance pas d'erreur", async () => {
    // Comportement volontaire (voir forgotPasswordAction dans
    // src/app/actions/auth.ts) : on ne révèle jamais si un compte existe.
    await expect(
      auth.api.requestPasswordReset({
        body: {
          email: uniqueEmail("unknown"),
          redirectTo: "/reinitialiser-mot-de-passe",
        },
        headers: new Headers(),
      }),
    ).resolves.toBeDefined()
  })
})
