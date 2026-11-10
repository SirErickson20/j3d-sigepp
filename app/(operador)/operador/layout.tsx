import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { OperadorShell } from "@/components/operador/OperadorShell";
import { getOperador } from "@/lib/auth";

// HU-01: el panel solo se muestra a un usuario con sesión y rol de operador.
export default async function OperadorSectionLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  const operador = await getOperador();
  if (!operador) redirect("/login");

  return <OperadorShell operador={{ nombre: operador.nombre, email: operador.email }}>{children}</OperadorShell>;
}
