"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { CircleAlertIcon, LockIcon, MoreHorizontalIcon, PlusIcon } from "lucide-react"
import { toast } from "sonner"

import { deleteRoleAction } from "@/app/actions/roles"
import { Alert, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip"

export type RoleRow = {
  id: string
  name: string
  description: string | null
  isSystem: boolean
  userCount: number
  permissions: string[]
}

type RolesTableProps = {
  roles: RoleRow[]
  // Identifiants des deux rôles système (voir ADMIN_ROLE_ID/MEMBER_ROLE_ID
  // dans src/lib/auth/permissions.ts), transmis en props plutôt qu'importés
  // ici : ce fichier ne peut pas importer src/lib/auth/permissions.ts
  // (accès base de données, voir le commentaire de PermissionMatrix).
  adminRoleId: string
  memberRoleId: string
}

function countLabel(count: number, singular: string, plural: string): string {
  return `${count} ${count > 1 ? plural : singular}`
}

// Tableau de gestion des rôles (/administration/roles). Mêmes choix que
// UsersTable (src/components/administration/users-table.tsx) : pas de
// pagination, et création/modification vivent sur des pages dédiées
// (/administration/roles/nouveau et /[id]) plutôt que dans des Dialog —
// seule la suppression (une confirmation destructrice, pas un formulaire)
// garde son AlertDialog ci-dessous.
export function RolesTable({ roles, adminRoleId, memberRoleId }: RolesTableProps) {
  const router = useRouter()
  const [deletingRole, setDeletingRole] = useState<RoleRow | null>(null)

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4">
        <div>
          <CardTitle>Rôles</CardTitle>
          <CardDescription>
            Rôles applicatifs et permissions accordées à chacun.
          </CardDescription>
        </div>
        <Button size="sm" render={<Link href="/administration/roles/nouveau" />}>
          <PlusIcon />
          Créer un rôle
        </Button>
      </CardHeader>
      <CardContent>
        <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Rôle</TableHead>
                <TableHead>Description</TableHead>
                <TableHead>Utilisateurs</TableHead>
                <TableHead>Permissions</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {roles.map((role) => {
                const isAdmin = role.id === adminRoleId
                const isMember = role.id === memberRoleId
                return (
                  <TableRow key={role.id}>
                    <TableCell>
                      <div className="font-medium">{role.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {role.id}
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {role.description || "—"}
                    </TableCell>
                    <TableCell>
                      {countLabel(
                        role.userCount,
                        "utilisateur",
                        "utilisateurs",
                      )}
                    </TableCell>
                    <TableCell>
                      {isAdmin ? (
                        <Badge variant="secondary">Toutes</Badge>
                      ) : (
                        countLabel(
                          role.permissions.length,
                          "permission",
                          "permissions",
                        )
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdmin ? (
                        <Tooltip>
                          <TooltipTrigger
                            render={
                              <span className="inline-flex size-8 items-center justify-center text-muted-foreground">
                                <LockIcon className="size-4" />
                                <span className="sr-only">
                                  Rôle protégé
                                </span>
                              </span>
                            }
                          />
                          <TooltipContent>
                            Le rôle Administrateur ne peut pas être modifié.
                          </TooltipContent>
                        </Tooltip>
                      ) : (
                        <DropdownMenu>
                          <DropdownMenuTrigger
                            render={
                              <Button variant="ghost" size="icon-sm">
                                <MoreHorizontalIcon />
                                <span className="sr-only">
                                  Actions pour {role.name}
                                </span>
                              </Button>
                            }
                          />
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem
                              render={
                                <Link href={`/administration/roles/${role.id}`} />
                              }
                            >
                              Modifier
                            </DropdownMenuItem>
                            {!isMember && (
                              <DropdownMenuItem
                                variant="destructive"
                                onClick={() => setDeletingRole(role)}
                              >
                                Supprimer
                              </DropdownMenuItem>
                            )}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      )}
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        </TooltipProvider>
      </CardContent>

      {deletingRole && (
        <DeleteRoleAlertDialog
          role={deletingRole}
          onOpenChange={(open) => !open && setDeletingRole(null)}
          onDeleted={() => {
            setDeletingRole(null)
            router.refresh()
          }}
        />
      )}
    </Card>
  )
}

type DeleteRoleAlertDialogProps = {
  role: RoleRow
  onOpenChange: (open: boolean) => void
  onDeleted: () => void
}

function DeleteRoleAlertDialog({
  role,
  onOpenChange,
  onDeleted,
}: DeleteRoleAlertDialogProps) {
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleDelete() {
    setIsPending(true)
    setError(null)
    try {
      const result = await deleteRoleAction(role.id)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Le rôle a été supprimé.")
      onDeleted()
    } finally {
      setIsPending(false)
    }
  }

  return (
    <AlertDialog open onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Supprimer le rôle {role.name} ?</AlertDialogTitle>
          <AlertDialogDescription>
            Cette action est irréversible.
          </AlertDialogDescription>
        </AlertDialogHeader>
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Annuler</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending ? "Suppression..." : "Supprimer"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
