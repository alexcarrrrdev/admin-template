# Admin Template

Projet personnel qui me sert de base commune pour tous les systèmes de gestion (admin / back-office) que je développe pour mes clients.

Plutôt que de repartir de zéro à chaque projet client, ce template regroupe la structure et les fonctionnalités de départ que je réutilise d'un système de gestion à l'autre.

## Technologies utilisées

- **[Next.js](https://nextjs.org)** (App Router) — framework React full-stack : le frontend et le backend (Server Actions, Route Handlers) vivent dans le même projet, ce qui donne une seule application à déployer par client.
- **[React](https://react.dev)** — bibliothèque UI.
- **[TypeScript](https://www.typescriptlang.org)** — typage statique de bout en bout, pour adapter le template d'un client à l'autre sans casser des choses silencieusement.
- **[Tailwind CSS](https://tailwindcss.com)** (v4) — styling utilitaire, facile à personnaliser aux couleurs de chaque client.
- **ESLint** — linting avec la configuration Next.js.
- **Turbopack** — bundler utilisé par `next dev` et `next build`.

## Démarrer

```bash
npm install
npm run dev
```

L'application tourne ensuite sur [http://localhost:3000](http://localhost:3000).
