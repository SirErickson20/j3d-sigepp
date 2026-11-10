'use client' // Los límites de error tienen que ser Client Components

import { useEffect } from 'react'
import Link from 'next/link'
import styles from '@/components/login/login.module.css'

// Lineamiento 3 del TP7: pantalla de error general para que el usuario nunca quede sin respuesta.
export default function Error({
  error,
  retry,
}: {
  error: Error & { digest?: string }
  retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>J3D - Impresiones</p>
        <h1>Algo salió mal</h1>
        <p className={styles.intro}>
          No pudimos mostrar esta pantalla. Probá de nuevo; si el problema sigue, avisanos por WhatsApp.
          {error.digest && <><br /><small>Código del error: {error.digest}</small></>}
        </p>
        <button className={styles.button} type="button" onClick={() => retry()}>Reintentar</button>
        <Link className={styles.back} href="/">← Volver al inicio</Link>
      </section>
    </main>
  )
}
