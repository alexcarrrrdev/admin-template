"use client"

import { useState } from "react"
import Link from "next/link"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import { toast } from "sonner"

import { resetPasswordAction } from "@/app/actions/auth"
import {
  resetPasswordSchema,
  type ResetPasswordInput,
} from "@/lib/schemas/auth"
import { Button } from "@/components/ui/button"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Input } from "@/components/ui/input"

type ResetPasswordFormProps = {
  token: string | undefined
}

export function ResetPasswordForm({ token }: ResetPasswordFormProps) {
  const [isPending, setIsPending] = useState(false)
  const form = useForm<ResetPasswordInput>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  })

  async function onSubmit(values: ResetPasswordInput) {
    setIsPending(true)
    try {
      // En cas de succès, resetPasswordAction() redirige elle-même vers "/".
      const result = await resetPasswordAction(values, token)
      if (result?.error) {
        toast.error(result.error)
      }
    } finally {
      setIsPending(false)
    }
  }

  if (!token) {
    return (
      <div className="flex flex-col gap-4">
        <p className="text-sm text-destructive">
          Ce lien de réinitialisation est invalide ou a expiré. Demandez-en un
          nouveau lien.
        </p>
        <Button
          className="w-full"
          render={<Link href="/mot-de-passe-oublie" />}
        >
          Demander un nouveau lien
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="flex flex-col gap-4"
      >
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Nouveau mot de passe</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Confirmer le mot de passe</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  autoComplete="new-password"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />
        <Button type="submit" className="mt-2 w-full" disabled={isPending}>
          {isPending
            ? "Réinitialisation en cours..."
            : "Réinitialiser le mot de passe"}
        </Button>
      </form>
    </Form>
  )
}
