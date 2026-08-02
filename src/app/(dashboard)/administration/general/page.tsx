import { redirect } from "next/navigation"

import { getCurrentSession } from "@/lib/auth/session"
import { canManageAppSettings, getAppName } from "@/lib/settings/app-settings"
import { AppNameForm } from "@/components/administration/app-name-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

// Vérification qui fait autorité : un utilisateur sans la permission
// `settings:update` ne doit pouvoir ni voir ni soumettre ce formulaire,
// même s'il navigue directement vers cette URL — le fait que l'entrée de
// menu « Administration » soit cachée (voir src/components/app-sidebar.tsx)
// n'est qu'un confort d'UI, pas une mesure de sécurité.
export default async function AdministrationGeneralPage() {
  const session = await getCurrentSession()

  if (!session) {
    redirect("/")
  }

  if (!canManageAppSettings(session.user)) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Accès refusé</CardTitle>
          <CardDescription>
            Vous n&apos;avez pas la permission d&apos;accéder à cette page.
          </CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const appName = await getAppName()

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Général</CardTitle>
          <CardDescription>
            Paramètres généraux de l&apos;application.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <AppNameForm defaultAppName={appName} />
        </CardContent>
      </Card>
    </div>
  )
}
