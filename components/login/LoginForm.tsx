"use client"

import { useActionState } from "react"
import { iniciarSesion, type LoginState } from "@/app/actions/auth"
import styles from "./login.module.css"

export function LoginForm({ next }: { next: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(iniciarSesion, undefined)

  return (
    <form className={styles.form} action={formAction}>
      <input type="hidden" name="next" value={next} />
      <label className={styles.field}>
        <span>Usuario (email)</span>
        <input name="email" type="email" autoComplete="username" required autoFocus />
      </label>
      <label className={styles.field}>
        <span>Contraseña</span>
        <input name="password" type="password" autoComplete="current-password" required />
      </label>
      {state?.error && <p className={styles.error} role="alert">{state.error}</p>}
      <button className={styles.button} type="submit" disabled={pending}>
        {pending ? "Ingresando..." : "Iniciar sesión"}
      </button>
    </form>
  )
}
