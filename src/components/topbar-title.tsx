"use client"

import { usePathname } from "next/navigation"

// Associe chaque route du tableau de bord à son titre affiché dans la
// barre supérieure.
const pageTitles: Record<string, string> = {
  "/tableau-de-bord": "Tableau de bord",
}

export function TopbarTitle() {
  const pathname = usePathname()
  const title = pageTitles[pathname] ?? "Admin Template"

  return <h1 className="text-sm font-medium">{title}</h1>
}
