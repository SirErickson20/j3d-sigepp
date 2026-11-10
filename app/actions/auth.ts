"use server";

import { redirect } from "next/navigation";
import { getOperador } from "@/lib/auth";
import { createSessionClient } from "@/lib/supabase/server";

export type LoginState = { error: string } | undefined;

function destinoSeguro(value: FormDataEntryValue | null) {
  const destino = String(value ?? "");
  // Solo rutas internas del panel, para no redirigir a otro sitio.
  return destino.startsWith("/operador") && !destino.startsWith("//") ? destino : "/operador";
}

// HU-01: el operador inicia sesión con usuario (email) y contraseña.
export async function iniciarSesion(_state: LoginState, formData: FormData): Promise<LoginState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (!email || !password) return { error: "Ingresá tu usuario y tu contraseña." };

  try {
    const supabase = await createSessionClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: "Usuario o contraseña incorrectos." };

    if (!(await getOperador())) {
      await supabase.auth.signOut();
      return { error: "Este usuario no tiene permiso de operador." };
    }
  } catch (error) {
    console.error("[iniciarSesion]", error);
    return { error: "No se pudo iniciar sesión. Probá de nuevo en unos minutos." };
  }

  redirect(destinoSeguro(formData.get("next")));
}

export async function cerrarSesion() {
  try {
    const supabase = await createSessionClient();
    await supabase.auth.signOut();
  } catch (error) {
    console.error("[cerrarSesion]", error);
  }
  redirect("/login");
}
