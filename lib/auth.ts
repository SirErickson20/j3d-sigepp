import { createAdminClient } from "@/lib/supabase/admin";
import { createSessionClient } from "@/lib/supabase/server";

export type Operador = { id: string; email: string; nombre: string };

// HU-01: devuelve el operador con sesión iniciada, o null si no hay sesión o el usuario no es operador.
// El rol se guarda en la tabla public.operadores (solo la lee el servidor con la clave de servicio).
export async function getOperador(): Promise<Operador | null> {
  try {
    const supabase = await createSessionClient();
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) return null;

    const admin = createAdminClient();
    const { data: operador } = await admin
      .from("operadores")
      .select("user_id, nombre")
      .eq("user_id", data.user.id)
      .eq("activo", true)
      .maybeSingle();
    if (!operador) return null;

    return { id: data.user.id, email: data.user.email ?? "", nombre: operador.nombre ?? data.user.email ?? "Operador" };
  } catch {
    return null;
  }
}

export const NO_AUTORIZADO = "Tu sesión no es válida o expiró. Volvé a iniciar sesión como operador.";

// Error 1 de la inspección del TP3: las Server Actions son endpoints públicos, así que cada acción
// del operador comprueba el rol en el servidor antes de usar la clave de servicio.
export async function requireOperador(): Promise<{ ok: true; operador: Operador } | { ok: false; error: string }> {
  const operador = await getOperador();
  return operador ? { ok: true, operador } : { ok: false, error: NO_AUTORIZADO };
}
