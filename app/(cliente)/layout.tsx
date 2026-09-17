import type { ReactNode } from "react";

type ClienteLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function ClienteLayout({ children }: ClienteLayoutProps) {
  return children;
}
