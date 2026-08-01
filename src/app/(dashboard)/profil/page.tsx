import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { roleLabels, type Role } from "@/lib/permissions"
import {
  ActiveSessionsCard,
  type SessionSummary,
} from "@/components/profile/active-sessions-card"
import { ChangePasswordForm } from "@/components/profile/change-password-form"
import { ProfileNameForm } from "@/components/profile/profile-name-form"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

function isKnownRole(role: string | null | undefined): role is Role {
  return !!role && role in roleLabels
}

export default async function ProfilPage() {
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/")
  }

  const roleLabel = isKnownRole(session.user.role)
    ? roleLabels[session.user.role]
    : session.user.role

  // La liste des sessions requiert une session « fraîche » côté Better Auth
  // (voir freshSessionMiddleware) ; en cas d'échec on affiche un message
  // plutôt que de faire planter toute la page.
  let sessions: SessionSummary[] = []
  let loadError = false
  try {
    const rawSessions = await auth.api.listSessions({
      headers: await headers(),
    })
    sessions = rawSessions
      .map((rawSession) => ({
        token: rawSession.token,
        ipAddress: rawSession.ipAddress ?? null,
        userAgent: rawSession.userAgent ?? null,
        createdAt: rawSession.createdAt.toISOString(),
        expiresAt: rawSession.expiresAt.toISOString(),
        isCurrent: rawSession.token === session.session.token,
      }))
      .sort((a, b) => Number(b.isCurrent) - Number(a.isCurrent))
  } catch {
    loadError = true
  }

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle>Mes informations</CardTitle>
          <CardDescription>
            Gérez les informations de votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ProfileNameForm
            defaultName={session.user.name}
            email={session.user.email}
            roleLabel={roleLabel}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Changer mon mot de passe</CardTitle>
          <CardDescription>
            Choisissez un nouveau mot de passe pour votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ChangePasswordForm />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Mes sessions actives</CardTitle>
          <CardDescription>
            Appareils actuellement connectés à votre compte.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ActiveSessionsCard sessions={sessions} loadError={loadError} />
        </CardContent>
      </Card>
    </div>
  )
}
