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
- **ESLint** — linting avec la configuration Next.js.
- **Turbopack** — bundler utilisé par `next dev` et `next build`.

## Démarrer

```bash
npm install
npm run dev
```

L'application tourne ensuite sur [http://localhost:3000](http://localhost:3000).

## Base de données

1. Copier `.env.example` vers `.env` (les valeurs par défaut fonctionnent avec le `docker-compose.yml` fourni) :

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
