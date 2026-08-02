# Admin Template

Projet personnel qui me sert de base commune pour tous les systèmes de gestion (admin / back-office) que je développe pour mes clients.

Plutôt que de repartir de zéro à chaque projet client, ce template regroupe la structure et les fonctionnalités de départ que je réutilise d'un système de gestion à l'autre.

## Technologies utilisées

- **[Next.js](https://nextjs.org)** (App Router) — framework React full-stack : le frontend et le backend (Server Actions, Route Handlers) vivent dans le même projet, ce qui donne une seule application à déployer par client.
- **[React](https://react.dev)** — bibliothèque UI.
- **[TypeScript](https://www.typescriptlang.org)** — typage statique de bout en bout, pour adapter le template d'un client à l'autre sans casser des choses silencieusement.
- **[Tailwind CSS](https://tailwindcss.com)** (v4) — styling utilitaire, facile à personnaliser aux couleurs de chaque client.
- **[PostgreSQL](https://www.postgresql.org)** — base de données relationnelle, lancée localement via Docker.
- **[Drizzle ORM](https://orm.drizzle.team)** — ORM TypeScript léger : schéma défini en TypeScript, migrations SQL lisibles et générées automatiquement, sans surcouche superflue.
- **[Better Auth](https://www.better-auth.com)** — authentification par courriel/mot de passe (connexion, réinitialisation de mot de passe) et permissions par rôle, branchée directement sur la base Postgres via l'adaptateur Drizzle.
- **ESLint** — linting avec la configuration Next.js.
- **Turbopack** — bundler utilisé par `next dev` et `next build`.

## Démarrer

```bash
npm install
npm run dev
```

L'application tourne ensuite sur [http://localhost:3000](http://localhost:3000).

## Base de données

1. Copier `.env.example` vers `.env` (les valeurs par défaut fonctionnent avec le `docker-compose.yml` fourni ; si un autre Postgres occupe déjà le port 5432 sur la machine, changer `POSTGRES_PORT` et le port dans `DATABASE_URL`) :

   ```bash
   cp .env.example .env
   ```

2. Démarrer PostgreSQL en local avec Docker :

   ```bash
   docker compose up -d
   ```

3. Appliquer les migrations :

   ```bash
   npm run db:migrate
   ```

Autres commandes utiles : `npm run db:generate` pour générer une nouvelle migration après une modification de `src/db/schema.ts`, et `npm run db:studio` pour ouvrir Drizzle Studio et explorer les données.

## Authentification

L'authentification (connexion, sessions, réinitialisation de mot de passe) est gérée par Better Auth. Il n'y a **pas d'inscription publique** : les comptes sont créés uniquement par un administrateur.

### Variables d'environnement

En plus de `DATABASE_URL`, deux variables sont nécessaires (voir `.env.example`) :

- `BETTER_AUTH_SECRET` — clé secrète servant à signer/chiffrer les sessions, d'au moins 32 caractères. Générer une valeur unique par environnement avec `openssl rand -base64 32`.
- `BETTER_AUTH_URL` — URL de base de l'application (ex. `http://localhost:3000` en local).

Ces trois variables (avec `DATABASE_URL`) sont validées une seule fois, au démarrage, par `src/lib/env.ts` : si l'une d'elles est absente ou mal formée (ex. secret trop court, URL invalide), l'application refuse de démarrer et affiche un message d'erreur explicite listant chaque variable en cause, plutôt que d'échouer plus tard de façon confuse.

### Limitation de débit (rate limiting)

Les tentatives de connexion et de réinitialisation de mot de passe sont limitées par IP, en production uniquement, avec des compteurs stockés en base (table `rate_limit`, survit aux redémarrages). Deux mécanismes appliquent cette même politique, car ils couvrent deux chemins d'accès distincts : le rate limiting intégré de Better Auth (`rateLimit` dans `src/lib/auth/index.ts`) protège les requêtes qui passent par son routeur HTTP, tandis que `src/lib/auth/rate-limit.ts` protège les Server Actions (`src/app/actions/auth.ts`), qui appellent l'API de Better Auth directement et contourneraient sinon entièrement cette protection.

### Créer le premier compte administrateur

```bash
npm run create-admin -- --name "Alex Caron" --email alex@exemple.com --password "MotDePasse123!"
```

Sans arguments, le script les demande un à un de façon interactive. Il crée l'utilisateur avec le rôle `admin` (voir `src/lib/auth/permissions.ts` pour le détail des rôles et permissions) en utilisant directement les fonctions internes de Better Auth, afin que le mot de passe soit haché exactement comme pour une connexion normale.

### Envoi de courriels (réinitialisation de mot de passe)

Aucun fournisseur de courriel n'est installé par défaut. Tant qu'aucun n'est configuré, `src/lib/email.ts` affiche simplement le message (destinataire, sujet, lien de réinitialisation) dans la console du serveur — pratique en développement, sans dépendance externe ni clé API.

Pour brancher un vrai fournisseur (ex. [Resend](https://resend.com), SMTP...) en production, il suffit de modifier la fonction `sendEmail` dans `src/lib/email.ts` : le reste de l'application (flux de réinitialisation de mot de passe, etc.) n'a rien à changer.

## Tests

Les tests utilisent [Vitest](https://vitest.dev), avec deux « projects » configurés dans `vitest.config.mts` :

- **`node`** — tests unitaires backend purs, sans base de données : `src/lib/auth/permissions.ts` (permissions par rôle), `src/lib/auth/schemas.ts` (validation Zod) et `src/lib/email.ts`.
- **`jsdom`** — tests de composants React (DOM simulé, [Testing Library](https://testing-library.com)) : les initiales dans `src/components/nav-user.tsx` et les formulaires d'authentification (`login-form.tsx`, `forgot-password-form.tsx`, `reset-password-form.tsx`). Les Server Actions (`src/app/actions/auth.ts`) y sont simulées avec `vi.mock`, aucun de ces tests ne touche à la base de données.

Un troisième project, **`integration`**, teste `src/lib/auth/index.ts` contre une vraie base Postgres locale (via `auth.api.signInEmail`, `signUpEmail`, etc., pas par HTTP) : création d'utilisateur, connexion, rejet de l'inscription publique, réinitialisation de mot de passe. Ces tests vivent dans des fichiers `*.integration.test.ts` et nécessitent Postgres démarré (`docker compose up -d`).

```bash
npm test                 # tout : node, jsdom et integration (Postgres requis)
npm run test:unit        # seulement node et jsdom, sans base de données
npm run test:integration # seulement les tests d'intégration
npm run test:watch       # mode watch, sans les tests d'intégration
```

Si Postgres n'est pas démarré, seuls les tests d'intégration échouent — les tests unitaires et de composants continuent de s'exécuter normalement, et le message d'erreur rappelle comment démarrer la base ou lancer `npm run test:unit`.

Chaque test d'intégration crée son propre utilisateur avec un courriel unique et le supprime après coup (`afterEach`) : la suite est rejouable sans risque et ne touche jamais aux comptes existants.

Les tests vivent à côté du code qu'ils couvrent (`src/**/*.test.ts(x)`), ce qui rend le pattern facile à reproduire pour tout nouveau fichier du template. Il n'y a pas de tests end-to-end (Playwright) dans ce template.
