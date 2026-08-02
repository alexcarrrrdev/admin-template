/**
 * Crée le premier compte administrateur.
 *
 * L'inscription publique est désactivée (emailAndPassword.disableSignUp
 * dans src/lib/auth/index.ts) : ce script est donc la façon de créer des comptes
 * pour ce template. Le mot de passe est haché avec la même fonction que
 * celle utilisée par Better Auth pour la connexion (context.password.hash),
 * en passant directement par l'adaptateur interne — pas par l'API HTTP
 * publique, qui refuse toute inscription.
 *
 * Utilisation :
 *   npm run create-admin -- --name "Alex Caron" --email alex@exemple.com --password "MotDePasse123!"
 *
 * Ou en mode interactif, sans arguments : le script demande les
 * informations une à une.
 */
import { createInterface } from "node:readline/promises"
import { stdin, stdout } from "node:process"

type Args = {
  name?: string
  email?: string
  password?: string
}

function parseArgs(): Args {
  const args: Args = {}
  const argv = process.argv.slice(2)
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i]
    if (arg === "--name") args.name = argv[++i]
    else if (arg === "--email") args.email = argv[++i]
    else if (arg === "--password") args.password = argv[++i]
  }
  return args
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: stdin, output: stdout })
  try {
    return (await rl.question(question)).trim()
  } finally {
    rl.close()
  }
}

async function main() {
  // Charger .env AVANT d'importer la config Better Auth : src/db/index.ts
  // lit DATABASE_URL dès son import, donc l'import doit être différé
  // (dynamique) jusqu'après le chargement des variables d'environnement.
  try {
    process.loadEnvFile()
  } catch {
    // Pas de fichier .env trouvé (ex. variables déjà fournies par
    // l'environnement) : on continue avec l'environnement existant.
  }

  const { auth } = await import("@/lib/auth")

  const args = parseArgs()

  const name = args.name ?? (await prompt("Nom complet : "))
  const emailInput = args.email ?? (await prompt("Courriel : "))
  const password =
    args.password ?? (await prompt("Mot de passe (min. 8 caractères) : "))

  const email = emailInput.trim().toLowerCase()

  if (!name.trim() || !email || !password) {
    console.error(
      "Erreur : le nom, le courriel et le mot de passe sont requis.",
    )
    process.exit(1)
  }

  if (password.length < 8) {
    console.error(
      "Erreur : le mot de passe doit contenir au moins 8 caractères.",
    )
    process.exit(1)
  }

  const context = await auth.$context

  const existing = await context.internalAdapter.findUserByEmail(email)
  if (existing) {
    console.error(
      `Erreur : un compte existe déjà avec le courriel « ${email} ».`,
    )
    process.exit(1)
  }

  const hashedPassword = await context.password.hash(password)

  const user = await context.internalAdapter.createUser({
    name: name.trim(),
    email,
    emailVerified: true,
    role: "admin",
  })

  await context.internalAdapter.linkAccount({
    userId: user.id,
    providerId: "credential",
    accountId: user.id,
    password: hashedPassword,
  })

  console.log("")
  console.log(
    `Compte administrateur créé avec succès : ${user.email} (rôle : admin).`,
  )
  console.log("Vous pouvez maintenant vous connecter avec ce compte sur /.")
  process.exit(0)
}

main().catch((error: unknown) => {
  console.error(
    "Erreur inattendue lors de la création de l'administrateur :",
    error,
  )
  process.exit(1)
})
