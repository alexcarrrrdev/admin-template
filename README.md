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

- `BETTER_AUTH_SECRET` — clé secrète servant à signer/chiffrer les sessions. Générer une valeur unique par environnement avec `openssl rand -base64 32`.
- `BETTER_AUTH_URL` — URL de base de l'application (ex. `http://localhost:3000` en local).

### Créer le premier compte administrateur

```bash
npm run create-admin -- --name "Alex Caron" --email alex@exemple.com --password "MotDePasse123!"
```

Sans arguments, le script les demande un à un de façon interactive. Il crée l'utilisateur avec le rôle `admin` (voir `src/lib/permissions.ts` pour le détail des rôles et permissions) en utilisant directement les fonctions internes de Better Auth, afin que le mot de passe soit haché exactement comme pour une connexion normale.

### Envoi de courriels (réinitialisation de mot de passe)

Aucun fournisseur de courriel n'est installé par défaut. Tant qu'aucun n'est configuré, `src/lib/email.ts` affiche simplement le message (destinataire, sujet, lien de réinitialisation) dans la console du serveur — pratique en développement, sans dépendance externe ni clé API.

Pour brancher un vrai fournisseur (ex. [Resend](https://resend.com), SMTP...) en production, il suffit de modifier la fonction `sendEmail` dans `src/lib/email.ts` : le reste de l'application (flux de réinitialisation de mot de passe, etc.) n'a rien à changer.
