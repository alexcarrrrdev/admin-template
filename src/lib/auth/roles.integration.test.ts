import { randomUUID } from "node:crypto"
import { eq, sql } from "drizzle-orm"
import { afterEach, beforeAll, describe, expect, it } from "vitest"

// Tests d'intégration de la gestion des rôles (src/lib/auth/roles.ts) contre
// un vrai Postgres local — voir src/lib/auth/auth.integration.test.ts pour
// le contexte général (chargement de .env, exécution via
// `npm run test:integration` uniquement). La logique pure (slugify) est
// testée sans base de données dans src/lib/auth/roles.test.ts.

type AuthModule = typeof import("@/lib/auth")
type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type RolesModule = typeof import("@/lib/auth/roles")
type PermissionsModule = typeof import("@/lib/auth/permissions")

let auth: AuthModule["auth"]
let db: DbModule["db"]
let dbSchema: SchemaModule
let listRoles: RolesModule["listRoles"]
let getRole: RolesModule["getRole"]
let createRole: RolesModule["createRole"]
let updateRole: RolesModule["updateRole"]
let deleteRole: RolesModule["deleteRole"]
let slugify: RolesModule["slugify"]
let getAllPermissions: PermissionsModule["getAllPermissions"]

// Utilisateurs et rôles créés par les tests de ce fichier, à supprimer après
// coup. Les utilisateurs sont TOUJOURS supprimés avant les rôles : un rôle
// encore référencé par un utilisateur ne peut pas être supprimé (contrainte
// ON DELETE RESTRICT, voir src/db/schema.ts) — même ordre que le nettoyage
// manuel fait dans le test "rôle encore utilisé" ci-dessous.
const createdUserIds: string[] = []
const createdRoleIds: string[] = []

function uniqueSuffix() {
  return randomUUID().slice(0, 6)
}

// Identifiant de rôle valide (voir SLUG_PATTERN dans src/lib/auth/roles.ts :
// 2 à 50 caractères, [a-z0-9-]) : volontairement court, contrairement au
// format uniqueEmail/uniqueRule des autres fichiers d'intégration, qui
// dépasserait cette limite.
function uniqueRoleId(label: string) {
  return `t-${label}-${uniqueSuffix()}`
}

function uniqueRoleName(label: string) {
  return `Rôle de test ${label} ${uniqueSuffix()}`
}

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé : on continue avec l'environnement existant.
  }

  const [authModule, dbModule, schemaModule, rolesModule, permissionsModule] =
    await Promise.all([
      import("@/lib/auth"),
      import("@/db"),
      import("@/db/schema"),
      import("@/lib/auth/roles"),
      import("@/lib/auth/permissions"),
    ])
  auth = authModule.auth
  db = dbModule.db
  dbSchema = schemaModule
  listRoles = rolesModule.listRoles
  getRole = rolesModule.getRole
  createRole = rolesModule.createRole
  updateRole = rolesModule.updateRole
  deleteRole = rolesModule.deleteRole
  slugify = rolesModule.slugify
  getAllPermissions = permissionsModule.getAllPermissions

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
  if (auth) {
    const context = await auth.$context
    while (createdUserIds.length > 0) {
      const id = createdUserIds.pop()
      if (id) await context.internalAdapter.deleteUser(id)
    }
  }
  while (createdRoleIds.length > 0) {
    const id = createdRoleIds.pop()
    if (id) await db.delete(dbSchema.role).where(eq(dbSchema.role.id, id))
  }
})

/** Crée un utilisateur de test avec le rôle donné, via l'adaptateur interne
 * de Better Auth — comme les autres fichiers d'intégration. */
async function createTestUserWithRole(role: string) {
  const context = await auth.$context
  const email = `test-integration-role-${uniqueSuffix()}@example.test`
  const hashedPassword = await context.password.hash("MotDePasse123!")

  const user = await context.internalAdapter.createUser({
    name: "Utilisateur de test (rôle)",
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
  return user
}

describe("listRoles — intégration Postgres", () => {
  it("inclut toujours les rôles système avec leur nombre d'utilisateurs", async () => {
    const before = await listRoles()
    const memberBefore = before.find((r) => r.id === "member")?.userCount ?? 0
    expect(before.map((r) => r.id)).toEqual(expect.arrayContaining(["admin", "member"]))

    await createTestUserWithRole("member")
    await createTestUserWithRole("member")

    const after = await listRoles()
    const memberAfter = after.find((r) => r.id === "member")?.userCount ?? 0

    expect(memberAfter).toBe(memberBefore + 2)
  })

  it("inclut un rôle personnalisé nouvellement créé, avec 0 utilisateur", async () => {
    const created = await createRole({ name: uniqueRoleName("liste"), permissions: [] })
    createdRoleIds.push(created.id)

    const roles = await listRoles()
    const found = roles.find((r) => r.id === created.id)

    expect(found).toBeDefined()
    expect(found?.userCount).toBe(0)
    expect(found?.isSystem).toBe(false)
  })
})

describe("getRole — intégration Postgres", () => {
  it("résout les permissions complètes du rôle admin (court-circuit, pas de rangée role_permission)", async () => {
    const admin = await getRole("admin")

    expect(admin?.isSystem).toBe(true)
    expect(new Set(admin?.permissions)).toEqual(getAllPermissions())
  })

  it("résout le rôle member avec ses permissions telles que stockées en base", async () => {
    // Ne pas supposer l'état seedé (migration 0005) : member est modifiable
    // depuis l'interface d'administration — on compare au contenu réel de
    // role_permission au moment du test.
    const rows = await db
      .select({ permission: dbSchema.rolePermission.permission })
      .from(dbSchema.rolePermission)
      .where(eq(dbSchema.rolePermission.roleId, "member"))

    const member = await getRole("member")

    expect(member?.isSystem).toBe(true)
    expect(new Set(member?.permissions)).toEqual(
      new Set(rows.map((row) => row.permission)),
    )
  })

  it("retourne null pour un rôle introuvable", async () => {
    expect(await getRole("role-qui-nexiste-pas")).toBeNull()
  })
})

describe("createRole — intégration Postgres", () => {
  it("dérive l'identifiant du nom quand aucun n'est fourni", async () => {
    const name = `Support Client ${uniqueSuffix()}`
    const created = await createRole({ name, permissions: ["user:read"] })
    createdRoleIds.push(created.id)

    expect(created.id).toBe(slugify(name))
    expect(created.isSystem).toBe(false)
    expect(created.permissions).toEqual(["user:read"])

    const fetched = await getRole(created.id)
    expect(fetched?.name).toBe(name)
  })

  it("accepte un identifiant fourni explicitement", async () => {
    const id = uniqueRoleId("explicit")
    const created = await createRole({ id, name: uniqueRoleName("explicit"), permissions: [] })
    createdRoleIds.push(created.id)

    expect(created.id).toBe(id)
  })

  it("refuse un identifiant déjà utilisé (rôle système)", async () => {
    await expect(
      createRole({ id: "admin", name: "Nouveau nom", permissions: [] }),
    ).rejects.toThrow(/existe déjà/i)
  })

  it("refuse une permission qui n'existe pas dans le catalogue", async () => {
    await expect(
      createRole({ name: uniqueRoleName("perm-invalide"), permissions: ["invoice:create"] }),
    ).rejects.toThrow(/permission inconnue/i)
  })

  it("refuse un nom vide", async () => {
    await expect(createRole({ name: "   ", permissions: [] })).rejects.toThrow(
      /nom du rôle est requis/i,
    )
  })
})

describe("updateRole — intégration Postgres", () => {
  it("modifie le nom, la description et les permissions d'un rôle personnalisé", async () => {
    const created = await createRole({
      name: uniqueRoleName("modifiable"),
      permissions: ["user:read"],
    })
    createdRoleIds.push(created.id)

    const updated = await updateRole(created.id, {
      name: "Nom mis à jour",
      description: "Nouvelle description",
      permissions: ["user:read", "user:update"],
    })

    expect(updated.name).toBe("Nom mis à jour")
    expect(updated.description).toBe("Nouvelle description")
    expect(new Set(updated.permissions)).toEqual(new Set(["user:read", "user:update"]))

    const fetched = await getRole(created.id)
    expect(fetched?.name).toBe("Nom mis à jour")
  })

  it("refuse de modifier le rôle admin", async () => {
    await expect(updateRole("admin", { name: "Nouveau nom" })).rejects.toThrow(
      /ne peut pas être modifié/i,
    )
  })

  it("permet de modifier le rôle member, sans effet permanent sur les autres tests", async () => {
    // "member" est un rôle système partagé par toute l'application (comme
    // le compte de développement) : on capture son état avant modification
    // et on le restaure toujours, même en cas d'échec de l'assertion — même
    // technique que app-settings.integration.test.ts pour la rangée
    // app_settings partagée.
    const original = await getRole("member")
    expect(original).not.toBeNull()

    try {
      const updated = await updateRole("member", { name: "Membre (test)" })
      expect(updated.name).toBe("Membre (test)")
      expect(updated.isSystem).toBe(true)
    } finally {
      if (original) {
        await updateRole("member", {
          name: original.name,
          description: original.description,
          permissions: original.permissions,
        })
      }
    }

    const restored = await getRole("member")
    expect(restored?.name).toBe(original?.name)
    expect(new Set(restored?.permissions)).toEqual(new Set(original?.permissions))
  })

  it("refuse une permission inconnue", async () => {
    const created = await createRole({ name: uniqueRoleName("update-perm-invalide"), permissions: [] })
    createdRoleIds.push(created.id)

    await expect(
      updateRole(created.id, { permissions: ["invoice:create"] }),
    ).rejects.toThrow(/permission inconnue/i)
  })

  it("refuse de modifier un rôle introuvable", async () => {
    await expect(updateRole("role-qui-nexiste-pas", { name: "X" })).rejects.toThrow(
      /introuvable/i,
    )
  })
})

describe("deleteRole — intégration Postgres", () => {
  it("supprime un rôle personnalisé inutilisé", async () => {
    const created = await createRole({ name: uniqueRoleName("supprimable"), permissions: [] })

    await deleteRole(created.id)

    expect(await getRole(created.id)).toBeNull()
  })

  it("refuse de supprimer le rôle admin", async () => {
    await expect(deleteRole("admin")).rejects.toThrow(/ne peut pas être supprimé/i)
  })

  it("refuse de supprimer le rôle member", async () => {
    await expect(deleteRole("member")).rejects.toThrow(/rôle par défaut/i)
  })

  it("refuse de supprimer un rôle introuvable", async () => {
    await expect(deleteRole("role-qui-nexiste-pas")).rejects.toThrow(/introuvable/i)
  })

  it("refuse de supprimer un rôle encore utilisé, avec le nombre d'utilisateurs concernés", async () => {
    const created = await createRole({ name: uniqueRoleName("utilise"), permissions: [] })
    createdRoleIds.push(created.id)

    await createTestUserWithRole(created.id)

    await expect(deleteRole(created.id)).rejects.toThrow(/1 utilisateur/i)

    // Toujours là malgré la tentative de suppression.
    expect(await getRole(created.id)).not.toBeNull()
  })
})
