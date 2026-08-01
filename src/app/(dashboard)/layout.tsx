import type { ReactNode } from "react"
import { headers } from "next/headers"
import { redirect } from "next/navigation"

import { auth } from "@/lib/auth"
import { getAppName } from "@/lib/app-settings"
import { AppSidebar } from "@/components/app-sidebar"
import { TopbarTitle } from "@/components/topbar-title"
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar"

export default async function DashboardLayout({
  children,
}: Readonly<{
  children: ReactNode
}>) {
  // Vérification qui fait autorité : session réellement valide en base
  // (contrairement à src/proxy.ts, qui ne fait qu'une vérification optimiste
  // basée sur la présence du cookie).
  const session = await auth.api.getSession({ headers: await headers() })

  if (!session) {
    redirect("/")
  }

  const appName = await getAppName()

  return (
    <SidebarProvider>
      <AppSidebar user={session.user} appName={appName} />
      <SidebarInset>
        <header className="sticky top-0 z-10 flex h-14 shrink-0 items-center gap-3 border-b bg-background px-4">
          <SidebarTrigger />
          <TopbarTitle />
        </header>
        <div className="flex flex-1 flex-col gap-4 p-4 md:p-6">{children}</div>
      </SidebarInset>
    </SidebarProvider>
  )
}
