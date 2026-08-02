import { eq, sql } from "drizzle-orm"
import { afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest"

// Tests d'intégration de la persistance des paramètres de l'application
// (table app_settings, à ligne unique) contre un vrai Postgres local — voir
// src/lib/auth/auth.integration.test.ts pour le contexte général (chargement de
// .env, exécution via `npm run test:integration` uniquement).
//
// La rangée est un singleton partagé par toute l'application (y compris le
// vrai environnement de développement) : chaque test capture son état avant
// modification et le restaure après, pour ne jamais laisser de nom
// personnalisé « fuiter » en dehors des tests.

type DbModule = typeof import("@/db")
type SchemaModule = typeof import("@/db/schema")
type AppSettingsModule = typeof import("@/lib/settings/app-settings")

let db: DbModule["db"]
let appSettings: SchemaModule["appSettings"]
let getAppName: AppSettingsModule["getAppName"]
let setAppName: AppSettingsModule["setAppName"]
let getLogo: AppSettingsModule["getLogo"]
let setLogo: AppSettingsModule["setLogo"]
let clearLogo: AppSettingsModule["clearLogo"]
let hasLogo: AppSettingsModule["hasLogo"]
let DEFAULT_APP_NAME: string
let APP_SETTINGS_ID: string

type AppSettingsRow = {
  id: string
  appName: string
  logo: Buffer | null
  logoMimeType: string | null
  updatedAt: Date
}

let originalRow: AppSettingsRow | undefined

beforeAll(async () => {
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé : on continue avec l'environnement existant.
  }

  const [dbModule, schemaModule, appSettingsModule] = await Promise.all([
    import("@/db"),
    import("@/db/schema"),
    import("@/lib/settings/app-settings"),
  ])
  db = dbModule.db
  appSettings = schemaModule.appSettings
  getAppName = appSettingsModule.getAppName
  setAppName = appSettingsModule.setAppName
  getLogo = appSettingsModule.getLogo
  setLogo = appSettingsModule.setLogo
  clearLogo = appSettingsModule.clearLogo
  hasLogo = appSettingsModule.hasLogo
  DEFAULT_APP_NAME = appSettingsModule.DEFAULT_APP_NAME
  APP_SETTINGS_ID = appSettingsModule.APP_SETTINGS_ID

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

beforeEach(async () => {
  const [row] = await db
    .select()
    .from(appSettings)
    .where(eq(appSettings.id, APP_SETTINGS_ID))
    .limit(1)
  originalRow = row
})

afterEach(async () => {
  if (originalRow) {
    await db
      .insert(appSettings)
      .values(originalRow)
      .onConflictDoUpdate({
        target: appSettings.id,
        set: {
          appName: originalRow.appName,
          logo: originalRow.logo,
          logoMimeType: originalRow.logoMimeType,
          updatedAt: originalRow.updatedAt,
        },
      })
  } else {
    await db.delete(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID))
  }
})

describe("app-settings — intégration Postgres", () => {
  it("retourne le nom par défaut quand aucune rangée n'existe", async () => {
    await db.delete(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(await getAppName()).toBe(DEFAULT_APP_NAME)
  })

  it("écrit un nom personnalisé puis le relit", async () => {
    await db.delete(appSettings).where(eq(appSettings.id, APP_SETTINGS_ID))

    await setAppName("Application de test")

    expect(await getAppName()).toBe("Application de test")
  })

  it("met à jour la rangée existante plutôt que d'en créer une nouvelle", async () => {
    await setAppName("Premier nom")
    await setAppName("Deuxième nom")

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.appName).toBe("Deuxième nom")
  })
})

describe("setLogo/getLogo/clearLogo — intégration Postgres", () => {
  it("retourne null et faux quand aucun logo n'est enregistré", async () => {
    await clearLogo()

    expect(await getLogo()).toBeNull()
    expect(await hasLogo()).toBe(false)
  })

  it("enregistre un logo puis le relit avec son type MIME", async () => {
    const data = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

    await setLogo(data, "image/png")

    const logo = await getLogo()
    expect(logo).not.toBeNull()
    expect(logo?.mimeType).toBe("image/png")
    expect(logo?.data.equals(data)).toBe(true)
    expect(await hasLogo()).toBe(true)
  })

  it("met à jour la rangée existante plutôt que d'en créer une nouvelle", async () => {
    await setLogo(Buffer.from([1, 2, 3]), "image/png")
    await setLogo(Buffer.from([4, 5, 6]), "image/webp")

    const rows = await db
      .select()
      .from(appSettings)
      .where(eq(appSettings.id, APP_SETTINGS_ID))

    expect(rows).toHaveLength(1)
    expect(rows[0]?.logoMimeType).toBe("image/webp")
    expect(rows[0]?.logo?.equals(Buffer.from([4, 5, 6]))).toBe(true)
  })

  it("ne touche pas au nom de l'application déjà enregistré", async () => {
    await setAppName("Nom conservé")

    await setLogo(Buffer.from([1, 2, 3]), "image/png")

    expect(await getAppName()).toBe("Nom conservé")
  })

  it("retire le logo enregistré", async () => {
    await setLogo(Buffer.from([1, 2, 3]), "image/png")

    await clearLogo()

    expect(await getLogo()).toBeNull()
    expect(await hasLogo()).toBe(false)
  })
})
