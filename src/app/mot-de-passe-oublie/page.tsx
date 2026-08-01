import type { Metadata } from "next"

import { ForgotPasswordForm } from "@/components/forgot-password-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export const metadata: Metadata = {
  title: "Mot de passe oublié",
}

export default function MotDePasseOubliePage() {
  return (
    <main className="flex min-h-svh flex-1 items-center justify-center p-4">
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle className="text-xl">Mot de passe oublié</CardTitle>
          <CardDescription>
            Entrez votre courriel pour recevoir un lien de réinitialisation.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ForgotPasswordForm />
        </CardContent>
      </Card>
    </main>
  )
}
