import type { ReactNode } from "react";

type OperadorLayoutProps = Readonly<{
  children: ReactNode;
}>;

export default function OperadorLayout({ children }: OperadorLayoutProps) {
  return children;
}
