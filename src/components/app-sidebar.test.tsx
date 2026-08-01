import { render, screen } from "@testing-library/react"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { AppSidebar } from "@/components/app-sidebar"
import { SidebarProvider } from "@/components/ui/sidebar"

let pathname = "/tableau-de-bord"

vi.mock("next/navigation", () => ({
  usePathname: () => pathname,
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

beforeEach(() => {
  pathname = "/tableau-de-bord"
})

function renderSidebar(role: string | null | undefined) {
  return render(
    <SidebarProvider>
      <AppSidebar
        user={{ name: "Alex Caron", email: "alex@exemple.com", role }}
        appName="Mon Application"
      />
    </SidebarProvider>,
  )
}

describe("AppSidebar", () => {
  it("affiche le nom de l'application configuré dans l'en-tête", () => {
    renderSidebar("admin")

    expect(screen.getByText("Mon Application")).toBeInTheDocument()
  })

  it("affiche toujours le lien Tableau de bord", () => {
    renderSidebar("member")

    expect(screen.getByText("Tableau de bord")).toBeInTheDocument()
  })

  it("affiche le groupe Administration pour un administrateur", () => {
    renderSidebar("admin")

    expect(screen.getByText("Administration")).toBeInTheDocument()
  })

  it("déplie le sous-menu quand la route courante s'y trouve", () => {
    pathname = "/administration/general"
    renderSidebar("admin")

    expect(screen.getByText("Général")).toBeInTheDocument()
  })

  it("garde le sous-menu replié quand la route courante est ailleurs", () => {
    renderSidebar("admin")

    expect(screen.queryByText("Général")).not.toBeInTheDocument()
  })

  it("cache le groupe Administration pour un membre, qui ne peut pas modifier les paramètres", () => {
    // Le membre a `settings:read` mais pas `settings:update` : la page
    // « Général » lui étant refusée, le groupe entier ne doit pas s'afficher
    // plutôt que de proposer un lien menant à un « Accès refusé ».
    renderSidebar("member")

    expect(screen.queryByText("Administration")).not.toBeInTheDocument()
  })

  it("cache le groupe Administration pour un rôle inconnu", () => {
    renderSidebar(undefined)

    expect(screen.queryByText("Administration")).not.toBeInTheDocument()
  })
})
