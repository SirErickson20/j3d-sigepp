// HU-01: da de alta (o reactiva) un usuario con rol de operador.
// Uso: node scripts/crear-operador.mjs <email> "<nombre>"
// La contraseña se pide por consola (no queda en el historial de comandos).
// Requiere haber ejecutado supabase/schema.sql (tabla public.operadores).

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createInterface } from "node:readline/promises";
import { stdin, stdout } from "node:process";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const [email, ...nombreParts] = process.argv.slice(2);
const nombre = nombreParts.join(" ").trim();
if (!email || !nombre) {
  console.error('Uso: node scripts/crear-operador.mjs <email> "<nombre>"');
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) throw new Error("Faltan variables de Supabase en .env.local");

const supabase = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
const emailNormalizado = email.trim().toLowerCase();

async function buscarUsuario() {
  for (let page = 1; page < 50; page += 1) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 });
    if (error) throw error;
    const user = data.users.find((item) => item.email?.toLowerCase() === emailNormalizado);
    if (user) return user;
    if (data.users.length < 200) return null;
  }
  return null;
}

let user = await buscarUsuario();

if (user) {
  console.log(`El usuario ${emailNormalizado} ya existe; se le asigna el rol de operador.`);
} else {
  const rl = createInterface({ input: stdin, output: stdout });
  const password = await rl.question("Contraseña para el operador (mínimo 8 caracteres): ");
  rl.close();
  if (password.length < 8) {
    console.error("La contraseña debe tener al menos 8 caracteres.");
    process.exit(1);
  }

  const { data, error } = await supabase.auth.admin.createUser({
    email: emailNormalizado,
    password,
    email_confirm: true,
  });
  if (error) throw error;
  user = data.user;
  console.log(`Usuario ${emailNormalizado} creado.`);
}

const { error } = await supabase
  .from("operadores")
  .upsert({ user_id: user.id, nombre, activo: true }, { onConflict: "user_id" });

if (error) {
  console.error(error.message);
  console.error("¿Ejecutaste supabase/schema.sql en el SQL Editor de Supabase?");
  process.exit(1);
}

console.log(`Listo: ${nombre} (${emailNormalizado}) puede iniciar sesión en /login.`);
