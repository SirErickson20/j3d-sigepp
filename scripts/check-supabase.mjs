import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createClient } from "@supabase/supabase-js";

const envPath = resolve(process.cwd(), ".env.local");
for (const line of readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
  if (match) process.env[match[1]] = match[2];
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !key) {
  throw new Error("Faltan variables de Supabase en .env.local");
}

const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const { error } = await supabase.from("pedidos").select("id").limit(1);
if (!error) {
  console.log("Las tablas ya existen.");
  process.exit(0);
}

console.error(error.message);
console.error("Ejecutá supabase/schema.sql en el SQL Editor de Supabase.");
process.exit(1);
