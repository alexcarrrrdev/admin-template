"use client"

import { useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { CircleAlertIcon } from "lucide-react"
import { toast } from "sonner"
import type { z } from "zod"

import { createRoleAction } from "@/app/actions/roles"
import { createRoleSchema, type CreateRoleInput } from "@/lib/auth/role-schemas"
import { slugify } from "@/lib/auth/slug"
import {
  PermissionMatrix,
  type PermissionCatalogEntry,
} from "@/components/administration/permission-matrix"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

export const ROLES_LIST_HREF = "/administration/roles"

type RoleCreateFormProps = {
  catalog: PermissionCatalogEntry[]
}

// Formulaire de création d'un rôle (/administration/roles/nouveau), page
// dédiée — voir le commentaire d'en-tête de UserCreateForm pour le choix
// « page plutôt que Dialog ».
export function RoleCreateForm({ catalog }: RoleCreateFormProps) {
  const router = useRouter()
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Tant que l'identifiant n'a pas été modifié à la main, il suit le nom via
  // `slugify` (voir src/lib/auth/slug.ts, la même normalisation que le
  // serveur) — dès que l'utilisateur le modifie lui-même, on arrête de
  // l'écraser à chaque frappe dans le champ "Nom".
  const [slugEditedManually, setSlugEditedManually] = useState(false)
  // Trois paramètres de type (entrée du formulaire / contexte / sortie
  // validée) : `permissions` a un `.default([])` dans createRoleSchema
  // (src/lib/auth/role-schemas.ts), donc son type d'ENTRÉE (avant
  // résolution Zod) le rend optionnel alors que son type de SORTIE
  // (CreateRoleInput, utilisé par createRoleAction) le rend requis.
  const form = useForm<
    z.input<typeof createRoleSchema>,
    unknown,
    CreateRoleInput
  >({
    resolver: zodResolver(createRoleSchema),
    defaultValues: { id: "", name: "", description: "", permissions: [] },
  })

  async function onSubmit(values: CreateRoleInput) {
    setIsPending(true)
    setError(null)
    try {
      const result = await createRoleAction(values)
      if (result?.error) {
        setError(result.error)
        return
      }
      toast.success("Le rôle a été créé.")
      // Pas de router.refresh() ici : appelé juste après router.push(), il
      // annule (ERR_ABORTED, vérifié empiriquement) la requête RSC de la
      // navigation en cours, laissant l'utilisateur bloqué sur cette page.
      // Inutile de toute façon : /administration/roles lit la session à
      // chaque rendu (cookies()), donc n'a AUCUNE durée de vie dans le
      // cache client (voir « Prefetching static vs. dynamic routes » dans
      // node_modules/next/dist/docs/01-app/02-guides/prefetching.md) —
      // router.push() y récupère déjà des données fraîches à lui seul.
      router.push(ROLES_LIST_HREF)
    } finally {
      setIsPending(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        {error && (
          <Alert variant="destructive">
            <CircleAlertIcon />
            <AlertTitle>{error}</AlertTitle>
          </Alert>
        )}
        <Card>
          <CardHeader>
            <CardTitle>Informations</CardTitle>
            <CardDescription>
              Nom, identifiant et description du rôle.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex flex-col gap-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nom</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        field.onChange(event)
                        if (!slugEditedManually) {
                          form.setValue("id", slugify(event.target.value))
                        }
                      }}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="id"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Identifiant</FormLabel>
                  <FormControl>
                    <Input
                      {...field}
                      onChange={(event) => {
                        setSlugEditedManually(true)
                        field.onChange(event)
                      }}
                    />
                  </FormControl>
                  <FormDescription>
                    Dérivé du nom ; modifiable uniquement avant la création.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Description (optionnelle)</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={2} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Permissions</CardTitle>
            <CardDescription>
              Permissions accordées à ce rôle, par ressource.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <FormField
              control={form.control}
              name="permissions"
              render={({ field }) => (
                <FormItem>
                  <PermissionMatrix
                    catalog={catalog}
                    value={field.value ?? []}
                    onChange={field.onChange}
                  />
                  <FormMessage />
                </FormItem>
              )}
            />
          </CardContent>
        </Card>
        <div className="flex justify-end gap-2">
          <Button variant="outline" render={<Link href={ROLES_LIST_HREF} />}>
            Annuler
          </Button>
          <Button type="submit" disabled={isPending}>
            {isPending ? "Création..." : "Créer"}
          </Button>
        </div>
      </form>
    </Form>
  )
}
