import { render, screen, waitFor, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { deleteUserAction } from "@/app/actions/users"
import { UsersTable, type UserRow } from "@/components/administration/users-table"

vi.mock("@/app/actions/users", () => ({
  deleteUserAction: vi.fn(),
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

const mockedDeleteUserAction = vi.mocked(deleteUserAction)

const users: UserRow[] = [
  {
    id: "u1",
    name: "Alex Caron",
    email: "alex@exemple.com",
    role: "admin",
    roleName: "Administrateur",
    createdAt: new Date("2026-01-15"),
  },
  {
    id: "u2",
    name: "Sam Tremblay",
    email: "sam@exemple.com",
    role: "member",
    roleName: "Membre",
    createdAt: new Date("2026-02-20"),
  },
]

beforeEach(() => {
  mockedDeleteUserAction.mockReset()
  mockRefresh.mockReset()
  mockToastSuccess.mockReset()
})

function renderTable(currentUserId = "u1") {
  return render(<UsersTable users={users} currentUserId={currentUserId} />)
}

describe("UsersTable — tableau", () => {
  it("affiche une ligne par utilisateur avec courriel, rôle et date de création", () => {
    renderTable()

    expect(screen.getByText("Alex Caron")).toBeInTheDocument()
    expect(screen.getByText("alex@exemple.com")).toBeInTheDocument()
    expect(screen.getAllByText("Administrateur").length).toBeGreaterThan(0)
    expect(screen.getByText("Sam Tremblay")).toBeInTheDocument()
    expect(screen.getByText("sam@exemple.com")).toBeInTheDocument()
    expect(screen.getByText("Membre")).toBeInTheDocument()
  })

  it("affiche le marqueur (vous) uniquement sur la ligne de l'utilisateur courant", () => {
    renderTable("u2")

    const samRow = screen.getByText("Sam Tremblay").closest("tr")
    const alexRow = screen.getByText("Alex Caron").closest("tr")
    expect(within(samRow!).getByText("(vous)")).toBeInTheDocument()
    expect(within(alexRow!).queryByText("(vous)")).not.toBeInTheDocument()
  })

  it("le bouton Créer un utilisateur pointe vers la page dédiée", () => {
    renderTable()

    expect(
      screen.getByRole("button", { name: /créer un utilisateur/i }),
    ).toHaveAttribute("href", "/administration/utilisateurs/nouveau")
  })

  it("l'action Modifier de chaque ligne pointe vers sa page d'édition", async () => {
    const user = userEvent.setup()
    renderTable()

    const row = screen.getByText("Sam Tremblay").closest("tr")!
    await user.click(
      within(row).getByRole("button", { name: "Actions pour Sam Tremblay" }),
    )

    // Base UI force role="menuitem" sur l'élément rendu (même si c'est un
    // <a> via `render`, voir DropdownMenuItem) : c'est donc ce rôle qu'il
    // faut interroger, pas "link" — le href reste bien celui du <a> sous-jacent.
    expect(
      await screen.findByRole("menuitem", { name: "Modifier" }),
    ).toHaveAttribute("href", "/administration/utilisateurs/u2")
  })
})

describe("UsersTable — suppression", () => {
  async function openDeleteDialog(rowName: string) {
    const user = userEvent.setup()
    renderTable()
    const row = screen.getByText(rowName).closest("tr")!
    await user.click(
      within(row).getByRole("button", { name: `Actions pour ${rowName}` }),
    )
    await user.click(await screen.findByRole("menuitem", { name: "Supprimer" }))
    await screen.findByRole("heading", { name: `Supprimer ${rowName} ?` })
    return user
  }

  it("affiche le courriel de l'utilisateur et un avertissement d'irréversibilité", async () => {
    await openDeleteDialog("Sam Tremblay")
    const dialog = screen.getByRole("alertdialog")

    expect(
      within(dialog).getByText(/cette action est irréversible/i),
    ).toBeInTheDocument()
    expect(within(dialog).getByText("sam@exemple.com")).toBeInTheDocument()
  })

  it("confirme la suppression puis affiche un succès", async () => {
    mockedDeleteUserAction.mockResolvedValue({})
    const user = await openDeleteDialog("Sam Tremblay")

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    await waitFor(() => {
      expect(mockedDeleteUserAction).toHaveBeenCalledWith("u2")
    })
    expect(mockToastSuccess).toHaveBeenCalledWith("L'utilisateur a été supprimé.")
    expect(mockRefresh).toHaveBeenCalled()
  })

  it("affiche le garde-fou serveur (auto-suppression) dans une alerte inline", async () => {
    mockedDeleteUserAction.mockResolvedValue({
      error: "Vous ne pouvez pas supprimer votre propre compte.",
    })
    const user = await openDeleteDialog("Alex Caron")

    await user.click(screen.getByRole("button", { name: "Supprimer" }))

    const alerte = await screen.findByRole("alert")
    expect(alerte).toHaveTextContent(
      "Vous ne pouvez pas supprimer votre propre compte.",
    )
    expect(mockToastSuccess).not.toHaveBeenCalled()
  })
})
