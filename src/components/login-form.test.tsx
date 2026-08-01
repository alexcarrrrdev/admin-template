import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { toast } from "sonner"
import { beforeEach, describe, expect, it, vi } from "vitest"

import { loginAction } from "@/app/actions/auth"
import { LoginForm } from "@/components/login-form"

// On isole le composant de la vraie Server Action (qui appellerait Better
// Auth et la base de données) et des modules Next.js qui supposent un
// contexte d'application complet.
vi.mock("@/app/actions/auth", () => ({
  loginAction: vi.fn(),
}))

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock("sonner", () => ({
  toast: { error: vi.fn(), success: vi.fn() },
}))

const mockedLoginAction = vi.mocked(loginAction)
const mockedToastError = vi.mocked(toast.error)

beforeEach(() => {
  mockedLoginAction.mockReset()
  mockedToastError.mockClear()
})

describe("LoginForm", () => {
  it("affiche les libellés en français", () => {
    render(<LoginForm />)

    expect(screen.getByLabelText("Courriel")).toBeInTheDocument()
    expect(screen.getByLabelText("Mot de passe")).toBeInTheDocument()
    expect(
      screen.getByRole("button", { name: "Se connecter" }),
    ).toBeInTheDocument()
  })

  it("affiche des erreurs de validation quand le formulaire est soumis vide", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.click(screen.getByRole("button", { name: "Se connecter" }))

    expect(
      await screen.findByText("Entrez un courriel valide."),
    ).toBeInTheDocument()
    expect(
      await screen.findByText("Le mot de passe est requis."),
    ).toBeInTheDocument()
    expect(mockedLoginAction).not.toHaveBeenCalled()
  })

  it("affiche une erreur de validation pour un courriel invalide", async () => {
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText("Courriel"), "pas-un-courriel")
    await user.type(screen.getByLabelText("Mot de passe"), "un-mot-de-passe")
    // fireEvent.submit plutôt que user.click(bouton) : une fois un champ
    // "dirty", @testing-library/user-event v14 ne laisse pas toujours le
    // temps au cycle de validation asynchrone (zodResolver) de se refléter
    // dans le DOM avant la fin de son act() interne. Soumettre directement
    // le formulaire contourne cet artefact d'environnement de test sans
    // changer ce qui est réellement vérifié (la validation elle-même).
    fireEvent.submit(screen.getByRole("button", { name: "Se connecter" }))

    expect(
      await screen.findByText("Entrez un courriel valide."),
    ).toBeInTheDocument()
    expect(mockedLoginAction).not.toHaveBeenCalled()
  })

  it("appelle l'action de connexion avec les valeurs saisies", async () => {
    mockedLoginAction.mockResolvedValue({})
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText("Courriel"), "alex@exemple.com")
    await user.type(screen.getByLabelText("Mot de passe"), "un-mot-de-passe")
    await user.click(screen.getByRole("button", { name: "Se connecter" }))

    await waitFor(() => {
      expect(mockedLoginAction).toHaveBeenCalledWith({
        email: "alex@exemple.com",
        password: "un-mot-de-passe",
      })
    })
  })

  it("affiche l'erreur retournée par l'action au moyen d'un toast", async () => {
    mockedLoginAction.mockResolvedValue({
      error: "Courriel ou mot de passe invalide.",
    })
    const user = userEvent.setup()
    render(<LoginForm />)

    await user.type(screen.getByLabelText("Courriel"), "alex@exemple.com")
    await user.type(screen.getByLabelText("Mot de passe"), "mauvais-mdp")
    await user.click(screen.getByRole("button", { name: "Se connecter" }))

    await waitFor(() => {
      expect(mockedToastError).toHaveBeenCalledWith(
        "Courriel ou mot de passe invalide.",
      )
    })
  })
})
