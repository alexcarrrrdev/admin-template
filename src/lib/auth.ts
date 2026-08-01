import { betterAuth } from "better-auth/minimal";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { nextCookies } from "better-auth/next-js";

import { db } from "@/db";
import * as schema from "@/db/schema";
import { sendEmail } from "@/lib/email";

// Configuration serveur de Better Auth. Voir node_modules/better-auth pour
// l'API exacte de la version installée (elle évolue vite).
export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL,
  secret: process.env.BETTER_AUTH_SECRET,
  database: drizzleAdapter(db, {
    provider: "pg",
    schema,
  }),
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
