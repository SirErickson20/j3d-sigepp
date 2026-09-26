// Pedidos de prueba con distintas fechas para probar el reporte de HU-15.
//   Cargar: node scripts/seed-reporte.mjs
//   Borrar: node scripts/seed-reporte.mjs --borrar
// Todos quedan a nombre del cliente "Prueba Reportes" y el borrado solo toca ese cliente.
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

const EMAIL_PRUEBA = "prueba-reportes@example.com";
const AR_OFFSET_HORAS = 3; // Argentina es UTC-3 todo el año

// Fecha de hoy en Argentina, sin importar la zona horaria de la máquina.
const [anio, mes, dia] = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Jujuy" })
  .format(new Date())
  .split("-")
  .map(Number);

// Instante UTC de un día y hora de Argentina.
function horaArgentina(diaDelMes, hora, minutos, mesOffset = 0) {
  return new Date(Date.UTC(anio, mes - 1 + mesOffset, diaDelMes, hora + AR_OFFSET_HORAS, minutos));
}
const haceDias = (dias, hora, minutos = 0) => horaArgentina(dia - dias, hora, minutos);
// Hoy, unos minutos antes de ahora (nunca en el futuro ni en el día anterior).
function hoyHaceMinutos(minutos) {
  const inicioDeHoy = horaArgentina(dia, 0, 1);
  const instante = new Date(Date.now() - minutos * 60_000);
  return instante < inicioDeHoy ? inicioDeHoy : instante;
}

// Cada caso cubre una situación distinta de los filtros del reporte.
const PEDIDOS = [
  { creado: hoyHaceMinutos(90), producto: "Mate", caso: "hoy" },
  { creado: hoyHaceMinutos(20), producto: "Llavero", caso: "hoy" },
  { creado: haceDias(2, 11), producto: "Mate", caso: "dentro de 7 días" },
  { creado: haceDias(5, 9, 30), producto: "Vaso", caso: "dentro de 7 días" },
  { creado: haceDias(5, 18, 20), producto: "Maceta", caso: "dentro de 7 días" },
  { creado: haceDias(8, 12), producto: "Llavero", caso: "fuera de 7 días, dentro de 30" },
  { creado: haceDias(8, 15, 45), producto: "Soporte", caso: "fuera de 7 días, dentro de 30" },
  { creado: haceDias(15, 10), producto: "Mate", caso: "dentro de 30 días" },
  { creado: haceDias(15, 17, 10), producto: "Juguete", caso: "dentro de 30 días" },
  { creado: horaArgentina(1, 0, 30), producto: "Medalla", caso: "primer día del mes, 00:30" },
  { creado: horaArgentina(0, 23, 30), producto: "Llavero", caso: "último día del mes anterior, 23:30 (en UTC ya es este mes)" },
  { creado: haceDias(31, 11), producto: "Llavero", caso: "fuera de 30 días" },
  { creado: haceDias(40, 14), producto: "Mate", caso: "hace 40 días" },
  { creado: haceDias(40, 16), producto: "Vaso", caso: "hace 40 días" },
  { creado: haceDias(70, 10), producto: "Maceta", caso: "hace 70 días" },
  { creado: haceDias(120, 10), producto: "Juguete", caso: "hace 120 días" },
  { creado: haceDias(120, 12), producto: "Llavero", caso: "hace 120 días" },
];

// Los pedidos viejos quedan avanzados (con su presupuesto Disponible), como en la tienda real.
function estadoSegunAntiguedad(creado) {
  const dias = (Date.now() - creado.getTime()) / 86_400_000;
  if (dias < 6) return "Pendiente de presupuesto";
  if (dias < 21) return "En producción";
  return "Entregado";
}

const fechaISO = (date) => date.toISOString().slice(0, 10);
const fechaAR = (date) =>
  new Intl.DateTimeFormat("es-AR", { timeZone: "America/Argentina/Jujuy", dateStyle: "short", timeStyle: "short" }).format(date);

async function borrar() {
  const { data: cliente, error } = await supabase.from("clientes").select("id").eq("email", EMAIL_PRUEBA).maybeSingle();
  if (error) throw error;
  if (!cliente) {
    console.log("No hay pedidos de prueba para borrar.");
    return;
  }
  // Los presupuestos se borran en cascada con sus pedidos.
  const { data: pedidos, error: pedidosError } = await supabase.from("pedidos").delete().eq("cliente_id", cliente.id).select("codigo");
  if (pedidosError) throw pedidosError;
  const { error: clienteError } = await supabase.from("clientes").delete().eq("id", cliente.id);
  if (clienteError) throw clienteError;
  console.log(`Borrados ${pedidos.length} pedidos de prueba y el cliente "Prueba Reportes".`);
}

async function cargar() {
  const { data: existente } = await supabase.from("clientes").select("id").eq("email", EMAIL_PRUEBA).maybeSingle();
  if (existente) {
    console.log("Ya hay pedidos de prueba cargados. Borralos primero con: node scripts/seed-reporte.mjs --borrar");
    process.exit(1);
  }

  const { data: cotizacion, error: cotizacionError } = await supabase
    .from("parametros_cotizacion")
    .select("id")
    .order("updated_at", { ascending: false })
    .limit(1)
    .single();
  if (cotizacionError) throw cotizacionError;

  const { data: cliente, error: clienteError } = await supabase
    .from("clientes")
    .insert({ nombre: "Prueba", apellido: "Reportes", email: EMAIL_PRUEBA, telefono: "3880000000" })
    .select("id")
    .single();
  if (clienteError) throw clienteError;

  for (const [index, pedido] of PEDIDOS.entries()) {
    const codigo = `R${1001 + index}`;
    const estado = estadoSegunAntiguedad(pedido.creado);
    const entrega = new Date(pedido.creado.getTime() + 7 * 86_400_000);
    const { data: fila, error } = await supabase
      .from("pedidos")
      .insert({
        codigo,
        cliente_id: cliente.id,
        estado,
        producto: pedido.producto,
        colores: ["Rojo"],
        cantidad: 1,
        diseno: `Pedido de prueba para el reporte (HU-15): ${pedido.caso}`,
        modalidad_entrega: "Retiro",
        fecha_estimada: fechaISO(entrega),
        created_at: pedido.creado.toISOString(),
        updated_at: pedido.creado.toISOString(),
      })
      .select("id")
      .single();
    if (error) throw error;

    if (estado !== "Pendiente de presupuesto") {
      const { error: presupuestoError } = await supabase.from("presupuestos").insert({
        pedido_id: fila.id,
        id_cotizacion: cotizacion.id,
        cantidad_material: 100,
        tiempo_horas: 2,
        cantidad_laca: 0,
        acetona_cm3: 0,
        fecha_entrega: fechaISO(entrega),
        total_calculado: 4096,
        total: 4096,
        estado: "Disponible",
        created_at: pedido.creado.toISOString(),
      });
      if (presupuestoError) throw presupuestoError;
    }

    console.log(`#${codigo}  ${fechaAR(pedido.creado).padEnd(16)}  ${pedido.producto.padEnd(8)}  ${estado.padEnd(24)}  ${pedido.caso}`);
  }
  console.log(`\nCargados ${PEDIDOS.length} pedidos de prueba. Para borrarlos: node scripts/seed-reporte.mjs --borrar`);
}

if (process.argv.includes("--borrar")) {
  await borrar();
} else {
  await cargar();
}
