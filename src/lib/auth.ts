import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { env } from "@/lib/env";
import { sendEmail } from "@/lib/email";
import { RATE_LIMIT_ENABLED } from "@/lib/rate-limit";

// Configuration serveur de Better Auth. Voir node_modules/better-auth pour
// l'API exacte de la version installée (elle évolue vite).
export const auth = betterAuth({
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
  // Le rate limiting de Better Auth n'est actif par défaut qu'en production
  // et stocké en mémoire (perdu à chaque redémarrage, non partagé entre
  // instances). On rend ce comportement explicite plutôt que de compter sur
  // le défaut implicite :
  //   - actif uniquement en production (RATE_LIMIT_ENABLED, définie dans
  //     src/lib/rate-limit.ts et PARTAGÉE avec enforceRateLimit — les
  //     Server Actions de src/app/actions/auth.ts appellent auth.api.*
  //     directement, sans passer par le routeur HTTP de Better Auth qui
  //     applique cette configuration, et ont donc besoin de leur propre
  //     limite avec la même politique d'activation, pour ne jamais diverger
  //     entre les deux) ;
  //   - stocké en base de données (table "rateLimit", voir src/db/schema.ts)
  //     pour survivre aux redémarrages et fonctionner avec plusieurs
  //     instances de l'application derrière un même Postgres.
  rateLimit: {
    enabled: RATE_LIMIT_ENABLED,
    storage: "database",
    // Limite générale par défaut : 100 requêtes par minute par IP+route,
    // pour les routes qui n'ont pas de règle plus stricte ci-dessous.
    window: 60,
    max: 100,
    customRules: {
      // Connexion : 10 tentatives par minute par IP. Suffisant pour un
      // utilisateur qui se trompe de mot de passe à quelques reprises,
      // assez strict pour ralentir une attaque par force brute sur les
      // mots de passe.
      "/sign-in/email": { window: 60, max: 10 },
      // Demande de réinitialisation de mot de passe : 5 tentatives par
      // 15 minutes par IP, pour empêcher qu'un tiers ne déclenche l'envoi
      // massif de courriels de réinitialisation vers une adresse ciblée.
      "/request-password-reset": { window: 60 * 15, max: 5 },
    },
  },
  emailAndPassword: {
    enabled: true,
    // Pas d'inscription publique : les comptes sont créés par un
    // administrateur, via `npm run create-admin` (voir scripts/create-admin.ts).
    disableSignUp: true,
    sendResetPassword: async ({ user, url }) => {
      await sendEmail({
        to: user.email,
        subject: "Réinitialisation de votre mot de passe",
        text: [
          `Bonjour ${user.name},`,
          "",
          "Une demande de réinitialisation de mot de passe a été effectuée pour votre compte.",
          "Cliquez sur le lien suivant pour choisir un nouveau mot de passe :",
          url,
          "",
          "Si vous n'êtes pas à l'origine de cette demande, vous pouvez ignorer ce courriel.",
        ].join("\n"),
      });
    },
  },
  user: {
    additionalFields: {
      // Rôle applicatif de l'utilisateur, utilisé par src/lib/permissions.ts.
      // `input: false` : le rôle ne peut pas être fourni via l'API publique
      // (création/mise à jour d'utilisateur) ; il est toujours défini côté
      // serveur (valeur par défaut "member", ou explicitement par
      // scripts/create-admin.ts).
      role: {
        type: "string",
        required: true,
        defaultValue: "member",
        input: false,
      },
    },
  },
  // Doit rester le dernier plugin : il permet aux appels serveur
  // (auth.api.*) de propager les cookies de session via `next/headers`.
  plugins: [nextCookies()],
});
