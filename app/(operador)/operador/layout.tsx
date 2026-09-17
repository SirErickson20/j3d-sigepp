import type { ReactNode } from "react";
import { OperadorShell } from "@/components/operador/OperadorShell";

export default function OperadorSectionLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <OperadorShell>{children}</OperadorShell>;
}
