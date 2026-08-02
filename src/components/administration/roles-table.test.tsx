import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteRoleAction } from "@/app/actions/roles"
import { RolesTable, type RoleRow } from "@/components/administration/roles-table"

vi.mock("@/app/actions/roles", () => ({
  deleteRoleAction: vi.fn(),
}))

const mockRefresh = vi.fn()
vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: mockRefresh,
  }),
}))

const mockToastSuccess = vi.fn()
vi.mock("sonner", () => ({
  toast: {
    success: (...args: unknown[]) => mockToastSuccess(...args),
  },
}))

const mockedDeleteRoleAction = vi.mocked(deleteRoleAction)

const roles: RoleRow[] = [
  {
    id: "admin",
    name: "Administrateur",
    description: "Accès complet à l'application.",
    isSystem: true,
    userCount: 1,
    permissions: [],
  },
  {
    id: "member",
    name: "Membre",
    description: null,
    isSystem: true,
    userCount: 3,
    permissions: ["settings:read"],
  },
  {
    id: "comptable",
    name: "Comptable",
    description: "Accès à la facturation.",
    isSystem: false,
    userCount: 1,
    permissions: ["user:read", "settings:read"],
  },
]

beforeEach(() => {
  mockedDeleteRoleAction.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

function renderTable() {
  return render(
    <RolesTable roles={roles} adminRoleId="admin" memberRoleId="member" />,
  )
}

describe("RolesTable — tableau", () => {
  it("affiche une ligne par rôle avec description, utilisateurs et permissions", () => {
    renderTable()

    expect(screen.getByText("Administrateur")).toBeInTheDocument()
    expect(screen.getByText("Toutes")).toBeInTheDocument()

    const memberRow = screen.getByText("Membre").closest("tr")!
    expect(within(memberRow).getByText("3 utilisateurs")).toBeInTheDocument()
    expect(within(memberRow).getByText("1 permission")).toBeInTheDocument()

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    expect(within(comptableRow).getByText("comptable")).toBeInTheDocument()
    expect(
      within(comptableRow).getByText("Accès à la facturation."),
    ).toBeInTheDocument()
    expect(within(comptableRow).getByText("1 utilisateur")).toBeInTheDocument()
    expect(within(comptableRow).getByText("2 permissions")).toBeInTheDocument()
  })

  it("verrouille le rôle admin : icône cadenas, pas de menu d'actions", () => {
    renderTable()

    const adminRow = screen.getByText("Administrateur").closest("tr")!
    expect(
      within(adminRow).queryByRole("button", { name: /actions pour/i }),
    ).not.toBeInTheDocument()
    expect(within(adminRow).getByText("Rôle protégé")).toBeInTheDocument()
  })

  it("le rôle membre est modifiable mais pas supprimable", async () => {
    const user = userEvent.setup()
    renderTable()

    const memberRow = screen.getByText("Membre").closest("tr")!
    await user.click(
      within(memberRow).getByRole("button", { name: /actions pour membre/i }),
    )

    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("menuitem", { name: "Supprimer" }),
    ).not.toBeInTheDocument()
  })

  it("un rôle personnalisé a Modifier et Supprimer dans son menu d'actions", async () => {
    const user = userEvent.setup()
    renderTable()

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    await user.click(
      within(comptableRow).getByRole("button", {
        name: /actions pour comptable/i,
      }),
    )

    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toBeInTheDocument()
    expect(
      screen.getByRole("menuitem", { name: "Supprimer" }),
    ).toBeInTheDocument()
  })

  it("les boutons Créer un rôle et Modifier pointent vers les pages dédiées", async () => {
    const user = userEvent.setup()
    renderTable()

    expect(
      screen.getByRole("button", { name: /créer un rôle/i }),
    ).toHaveAttribute("href", "/administration/roles/nouveau")

    const comptableRow = screen.getByText("Comptable").closest("tr")!
    await user.click(
      within(comptableRow).getByRole("button", {
        name: /actions pour comptable/i,
      }),
    )
    // Voir le commentaire équivalent dans users-table.test.tsx : Base UI
    // force role="menuitem" sur l'élément rendu, même via `render={<Link />}`.
    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toHaveAttribute("href", "/administration/roles/comptable")
  })
})

describe("RolesTable — suppression", () => {
  async function openDeleteDialog(rowName: string) {
    const user = userEvent.setup()
    renderTable()
    const row = screen.getByText(rowName).closest("tr")!
    await user.click(
      within(row).getByRole("button", { name: `Actions pour ${rowName}` }),
    )
    await user.click(
      await screen.findByRole("menuitem", { name: "Supprimer" }),
    )
    await screen.findByRole("heading", {
      name: `Supprimer le rôle ${rowName} ?`,
    })
    return user
  }

  it("confirme la suppression puis affiche un succès", async () => {
    mockedDeleteRoleAction.mockResolvedValue({})
    const user = await openDeleteDialog("Comptable")

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    await waitFor(() => {
      expect(mockedDeleteRoleAction).toHaveBeenCalledWith("comptable")
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("Le rôle a été supprimé.")
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche le garde-fou serveur (rôle encore utilisé) dans une alerte inline", async () => {
    mockedDeleteRoleAction.mockResolvedValue({
      error: "Impossible de supprimer ce rôle : 1 utilisateur l'utilise encore.",
    })
    const user = await openDeleteDialog("Comptable")

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Impossible de supprimer ce rôle : 1 utilisateur l'utilise encore.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
