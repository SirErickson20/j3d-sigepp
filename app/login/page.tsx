import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login/LoginForm";
import styles from "@/components/login/login.module.css";
import { getOperador } from "@/lib/auth";

export const metadata: Metadata = { title: "Iniciar sesión · J3D - Impresiones" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const params = await searchParams;
  const nextParam = typeof params.next === "string" ? params.next : "";
  const next = nextParam.startsWith("/operador") ? nextParam : "/operador";

  if (await getOperador()) redirect(next);

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <p className={styles.brand}>J3D - Impresiones</p>
        <h1>Panel del operador</h1>
        <p className={styles.intro}>Iniciá sesión para gestionar pedidos, cotizaciones y presupuestos.</p>
        <LoginForm next={next} />
        <Link className={styles.back} href="/">← Volver al inicio</Link>
      </section>
    </main>
  );
}
