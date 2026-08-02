"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  ChevronRightIcon,
  LayoutDashboard,
  Settings2Icon,
  ShieldCheck,
  type LucideIcon,
} from "lucide-react"

import { hasPermission } from "@/lib/auth/permissions"
import { NavUser } from "@/components/nav-user"
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible"
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
} from "@/components/ui/sidebar"

// Chaque entrée peut déclarer sa propre condition d'accès. Une entrée dont
// la condition n'est pas remplie est masquée : on n'affiche jamais un lien
// qui mènerait à un « Accès refusé ». Ce n'est qu'un confort d'UI — la
// sécurité réelle est appliquée côté serveur, dans la page et dans la
// Server Action correspondantes.
type NavAccess = (user: SidebarUser) => boolean

type NavLeaf = {
  title: string
  href: string
  canAccess?: NavAccess
}

type NavItem = {
  title: string
  href: string
  icon: LucideIcon
  canAccess?: NavAccess
  // Présent uniquement pour les entrées avec sous-menu (ex. "Administration").
  // Ajouter une future page à ce sous-menu (ex. "Utilisateurs", "Journal
  // d'audit") revient à ajouter une entrée à ce tableau, avec la permission
  // qu'elle exige.
  items?: NavLeaf[]
}

// Navigation principale du back-office. Ajouter une entrée de premier
// niveau ici suffit à l'afficher dans la barre latérale.
const navItems: NavItem[] = [
  { title: "Tableau de bord", href: "/tableau-de-bord", icon: LayoutDashboard },
]

// Groupe "Administration". Une seule page existe pour l'instant
// ("Général") — les entrées futures s'ajoutent à `items` sans créer de
// pages vides tant qu'elles n'existent pas. Le groupe entier disparaît si
// aucune de ses entrées n'est accessible à l'utilisateur.
const administrationNavItem: NavItem = {
  title: "Administration",
  href: "/administration",
  icon: Settings2Icon,
  items: [
    {
      title: "Général",
      href: "/administration/general",
      canAccess: (user) => hasPermission(user, "settings", "update"),
    },
  ],
}

type SidebarUser = {
  name: string
  email: string
  role?: string | null
}

type AppSidebarProps = {
  user: SidebarUser
  appName: string
}

// Filtre la navigation selon les permissions de l'utilisateur : les entrées
// interdites sont retirées, et un groupe vidé de toutes ses entrées
// disparaît lui aussi.
function visibleNavItems(user: SidebarUser): NavItem[] {
  return [...navItems, administrationNavItem]
    .map((item) =>
      item.items
        ? {
            ...item,
            items: item.items.filter((leaf) => leaf.canAccess?.(user) ?? true),
          }
        : item,
    )
    .filter((item) =>
      item.items ? item.items.length > 0 : (item.canAccess?.(user) ?? true),
    )
}

export function AppSidebar({ user, appName }: AppSidebarProps) {
  const pathname = usePathname()
  const items = visibleNavItems(user)

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link href="/tableau-de-bord" />}>
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <ShieldCheck className="size-4" />
              </div>
              <span className="truncate text-sm font-semibold">{appName}</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {items.map((item) =>
                item.items ? (
                  <NavItemWithSubmenu
                    key={item.href}
                    item={item}
                    items={item.items}
                    pathname={pathname}
                  />
                ) : (
                  <SidebarMenuItem key={item.href}>
                    <SidebarMenuButton
                      render={<Link href={item.href} />}
                      tooltip={item.title}
                      isActive={pathname.startsWith(item.href)}
                    >
                      <item.icon />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ),
              )}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>
        <NavUser user={user} />
      </SidebarFooter>
    </Sidebar>
  )
}

type NavItemWithSubmenuProps = {
  item: NavItem
  items: NavLeaf[]
  pathname: string
}

function NavItemWithSubmenu({ item, items, pathname }: NavItemWithSubmenuProps) {
  const isActive = pathname.startsWith(item.href)
  // Ouvert par défaut si la route courante est dans ce sous-menu, et
  // s'ouvre automatiquement si on y navigue ensuite (le composant ne
  // remonte pas lors d'une navigation côté client au sein du layout).
  // Ajustement du state pendant le rendu plutôt que dans un effet — voir
  // https://react.dev/reference/react/useState#storing-information-from-previous-renders
  const [open, setOpen] = useState(isActive)
  const [prevIsActive, setPrevIsActive] = useState(isActive)
  if (isActive !== prevIsActive) {
    setPrevIsActive(isActive)
    if (isActive) setOpen(true)
  }

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <SidebarMenuItem>
        <CollapsibleTrigger
          render={
            <SidebarMenuButton
              tooltip={item.title}
              isActive={isActive}
              className="group/nav-collapsible"
            />
          }
        >
          <item.icon />
          <span>{item.title}</span>
          <ChevronRightIcon className="ml-auto transition-transform duration-200 group-data-[panel-open]/nav-collapsible:rotate-90" />
        </CollapsibleTrigger>
        <CollapsibleContent>
          <SidebarMenuSub>
            {items.map((subItem) => (
              <SidebarMenuSubItem key={subItem.href}>
                <SidebarMenuSubButton
                  render={<Link href={subItem.href} />}
                  isActive={pathname === subItem.href}
                >
                  <span>{subItem.title}</span>
                </SidebarMenuSubButton>
              </SidebarMenuSubItem>
            ))}
          </SidebarMenuSub>
        </CollapsibleContent>
      </SidebarMenuItem>
    </Collapsible>
  )
}
