"use server";

import { revalidatePath } from "next/cache";
import { requireOperador } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateOrderCode,
  mapCotizacion,
  mapPedido,
  normalizeOrderCode,
  toClientOrder,
} from "@/lib/pedidos/mappers";
import { calcularPresupuesto } from "@/lib/pedidos/calculo";
import { requierePresupuesto, siguienteEstadoManual } from "@/lib/pedidos/estados";
import {
  EXTENSION_POR_TIPO,
  MAX_ARCHIVO_BYTES,
  MAX_LARGO_DISENO,
  MAX_LARGO_TEXTO,
  MENSAJE_ARCHIVO_INVALIDO,
  CANTIDAD_MAXIMA,
  DIGITOS_TELEFONO,
  detectarTipoArchivo,
  esCantidadValida,
  esEmailValido,
  esProductoValido,
  esTelefonoValido,
} from "@/lib/pedidos/validacion";
import {
  COLOR_BY_VALUE,
  ORDER_STATUSES,
  PEDIDO_SELECT,
  type ClientOrder,
  type Cotizacion,
  type CotizacionRow,
  type CotizacionValues,
  type Order,
  type OrderStatus,
  type PedidoRow,
} from "@/lib/pedidos/types";

type AdminClient = ReturnType<typeof createAdminClient>;
type Result<T> = ({ ok: true } & T) | { ok: false; error: string };

const BUCKET = "referencias";
const SIGNED_URL_SECONDS = 60 * 60;
const ERROR_INESPERADO = "Ocurrió un error inesperado. Probá de nuevo en unos minutos.";

function schemaError(message: string) {
  return /could not find the (table|function)|schema cache|PGRST20[2-5]|could not find the .* column|does not exist/i.test(message)
    ? "Falta actualizar las tablas en Supabase. Ejecutá supabase/schema.sql en el SQL Editor."
    : message;
}

// Lineamiento 3 del TP7: ninguna acción deja escapar una excepción sin respuesta para el usuario.
async function seguro<T>(accion: string, fn: () => Promise<Result<T>>): Promise<Result<T>> {
  try {
    return await fn();
  } catch (error) {
    console.error(`[${accion}]`, error);
    return { ok: false, error: ERROR_INESPERADO };
  }
}

function asString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

// Los archivos de referencia están en un bucket privado: el operador los ve con enlaces temporales.
async function conEnlacesFirmados(supabase: AdminClient, orders: Order[]): Promise<Order[]> {
  const paths = [...new Set(orders.map((order) => order.referenceUrl).filter((path): path is string => Boolean(path)))];
  if (paths.length === 0) return orders;

  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_SECONDS);
  if (error || !data) return orders.map((order) => ({ ...order, referenceUrl: undefined }));

  const byPath = new Map(data.map((item) => [item.path, item.signedUrl]));
  return orders.map((order) => ({
    ...order,
    referenceUrl: order.referenceUrl ? byPath.get(order.referenceUrl) ?? undefined : undefined,
  }));
}

async function leerPedido(supabase: AdminClient, orderId: string): Promise<Result<{ order: Order }>> {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false, error: schemaError(error.message) };
  if (!data) return { ok: false, error: "No se encontró el pedido." };
  const [order] = await conEnlacesFirmados(supabase, [mapPedido(data as PedidoRow)]);
  return { ok: true, order };
}

type ArchivoSubido = { nombre: string | null; path: string | null };

// Petición de cambio 005/26 y error 8 del TP3: el tipo se reconoce por el contenido del archivo
// (no por el tipo MIME que informa el celular) y si la subida falla se le avisa al cliente.
async function subirReferencia(supabase: AdminClient, file: File | null): Promise<Result<{ archivo: ArchivoSubido }>> {
  if (!file || file.size === 0) return { ok: true, archivo: { nombre: null, path: null } };

  if (file.size > MAX_ARCHIVO_BYTES) {
    return { ok: false, error: "El archivo de referencia no puede superar 5 MB." };
  }

  const bytes = new Uint8Array(await file.arrayBuffer());
  const tipo = detectarTipoArchivo(bytes);
  if (!tipo) return { ok: false, error: MENSAJE_ARCHIVO_INVALIDO };

  const path = `${Date.now()}-${crypto.randomUUID()}.${EXTENSION_POR_TIPO[tipo]}`;
  const { error } = await supabase.storage.from(BUCKET).upload(path, bytes, { contentType: tipo, upsert: false });
  if (error) {
    console.error("[subirReferencia]", error.message);
    return {
      ok: false,
      error: "No pudimos subir el archivo de referencia. Probá de nuevo o enviá el pedido sin archivo.",
    };
  }

  return { ok: true, archivo: { nombre: file.name.slice(0, 200), path } };
}

// Error 5 del TP3: si el email ya existe se reutiliza el cliente sin modificar sus datos,
// para que nadie pueda cambiar el nombre o el teléfono de otro cliente usando su email.
async function obtenerCliente(
  supabase: AdminClient,
  datos: { nombre: string; apellido: string; email: string; telefono: string },
): Promise<Result<{ clienteId: string }>> {
  const { error: insertError } = await supabase
    .from("clientes")
    .upsert(datos, { onConflict: "email", ignoreDuplicates: true });
  if (insertError) return { ok: false, error: schemaError(insertError.message) };

  const { data, error } = await supabase.from("clientes").select("id").eq("email", datos.email).single();
  if (error || !data) return { ok: false, error: schemaError(error?.message ?? "No se pudo guardar el cliente.") };
  return { ok: true, clienteId: data.id };
}

export async function createPedido(formData: FormData): Promise<Result<{ codigo: string }>> {
  return seguro("createPedido", async () => {
    const producto = asString(formData, "producto");
    const colors = [...new Set(formData.getAll("colors").map((value) => COLOR_BY_VALUE[String(value)]).filter(Boolean))];
    const cantidadTexto = asString(formData, "cantidad") || "1";
    const cantidad = Number(cantidadTexto);
    const diseno = asString(formData, "diseno");
    const nombre = asString(formData, "nombre");
    const apellido = asString(formData, "apellido");
    const email = asString(formData, "email").toLowerCase();
    const telefono = asString(formData, "telefono");
    const deliveryValue = asString(formData, "delivery");
    const delivery = deliveryValue === "shipping" ? "Envío" : "Retiro";
    const domicilio = delivery === "Envío" ? asString(formData, "domicilio") || null : null;
    const ciudad = delivery === "Envío" ? asString(formData, "ciudad") || null : null;
    const codigoPostal = delivery === "Envío" ? asString(formData, "codigo_postal") || null : null;
    const archivo = formData.get("archivo");
    const file = archivo instanceof File ? archivo : null;

    // Errores 3 y 4 del TP3: el servidor valida todo, aunque el formulario ya lo haya hecho.
    if (!producto || colors.length === 0 || !diseno || !nombre || !apellido || !email || !telefono) {
      return { ok: false, error: "Completá todos los campos obligatorios." };
    }
    if (!esProductoValido(producto)) return { ok: false, error: "Elegí un tipo de producto de la lista." };
    if (!/^\d+$/.test(cantidadTexto) || !esCantidadValida(cantidad)) {
      return { ok: false, error: `La cantidad debe ser un número entero entre 1 y ${CANTIDAD_MAXIMA}.` };
    }
    if (!esEmailValido(email)) return { ok: false, error: "Ingresá un email válido (por ejemplo, nombre@correo.com)." };
    if (!esTelefonoValido(telefono)) {
      return { ok: false, error: `El teléfono debe tener exactamente ${DIGITOS_TELEFONO} dígitos.` };
    }
    if (deliveryValue !== "pickup" && deliveryValue !== "shipping") {
      return { ok: false, error: "Elegí una modalidad de entrega." };
    }
    if (delivery === "Envío" && (!domicilio || !ciudad || !codigoPostal)) {
      return { ok: false, error: "Completá el domicilio de envío." };
    }
    const textos = [nombre, apellido, domicilio ?? "", ciudad ?? "", codigoPostal ?? ""];
    if (textos.some((texto) => texto.length > MAX_LARGO_TEXTO) || diseno.length > MAX_LARGO_DISENO) {
      return { ok: false, error: "Alguno de los campos es demasiado largo." };
    }

    const supabase = createAdminClient();
    const subida = await subirReferencia(supabase, file);
    if (!subida.ok) return subida;
    const { archivo: uploaded } = subida;

    const borrarArchivo = async () => {
      if (uploaded.path) await supabase.storage.from(BUCKET).remove([uploaded.path]);
    };

    const cliente = await obtenerCliente(supabase, { nombre, apellido, email, telefono });
    if (!cliente.ok) {
      await borrarArchivo();
      return cliente;
    }

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await supabase
        .from("pedidos")
        .insert({
          codigo: generateOrderCode(),
          cliente_id: cliente.clienteId,
          estado: "Pendiente de presupuesto",
          producto,
          colores: colors,
          cantidad,
          diseno,
          archivo_nombre: uploaded.nombre,
          archivo_url: uploaded.path,
          modalidad_entrega: delivery,
          domicilio,
          ciudad,
          codigo_postal: codigoPostal,
        })
        .select("codigo")
        .single();

      if (!error && data) {
        revalidatePath("/operador");
        return { ok: true, codigo: data.codigo };
      }

      // 23505 en el código: se reintenta con otro. Cualquier otro error corta.
      if (error?.code === "23505" && /codigo/.test(error.message)) continue;

      await borrarArchivo();
      return { ok: false, error: schemaError(error?.message ?? "No se pudo guardar el pedido.") };
    }

    await borrarArchivo();
    return { ok: false, error: "No se pudo generar un código único. Probá de nuevo." };
  });
}

// HU-06 / HU-10: consulta pública. Solo devuelve lo que muestra toClientOrder (sin datos personales).
export async function consultarPedido(code: string): Promise<Result<{ order: ClientOrder | null }>> {
  return seguro<{ order: ClientOrder | null }>("consultarPedido", async () => {
    const codigo = normalizeOrderCode(code);
    if (!codigo || codigo.length > 16 || !/^[A-Z0-9]+$/.test(codigo)) return { ok: true, order: null };

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("pedidos")
      .select(PEDIDO_SELECT)
      .eq("codigo", codigo)
      .maybeSingle();

    if (error) return { ok: false, error: schemaError(error.message) };
    return { ok: true, order: data ? toClientOrder(mapPedido(data as PedidoRow)) : null };
  });
}

export async function listarPedidos(): Promise<Result<{ orders: Order[] }>> {
  return seguro("listarPedidos", async () => {
    const auth = await requireOperador();
    if (!auth.ok) return auth;

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("pedidos")
      .select(PEDIDO_SELECT)
      .order("created_at", { ascending: false });

    if (error) return { ok: false, error: schemaError(error.message) };
    const orders = (data as PedidoRow[] | null)?.map(mapPedido) ?? [];
    return { ok: true, orders: await conEnlacesFirmados(supabase, orders) };
  });
}

export async function actualizarEstadoPedido(id: string, status: OrderStatus): Promise<Result<{ order: Order }>> {
  return seguro("actualizarEstadoPedido", async () => {
    const auth = await requireOperador();
    if (!auth.ok) return auth;

    if (!ORDER_STATUSES.includes(status)) {
      return { ok: false, error: "Estado inválido." };
    }

    const supabase = createAdminClient();
    const { data: current, error: currentError } = await supabase
      .from("pedidos")
      .select("estado")
      .eq("id", id)
      .maybeSingle();

    if (currentError) return { ok: false, error: schemaError(currentError.message) };
    if (!current) return { ok: false, error: "No se encontró el pedido." };

    const estadoActual = current.estado as OrderStatus;
    if (requierePresupuesto(estadoActual)) {
      return {
        ok: false,
        error: 'Este pedido pasa solo a "Pendiente de seña" cuando su presupuesto queda disponible. Terminalo desde la sección Presupuesto.',
      };
    }

    const siguiente = siguienteEstadoManual(estadoActual);
    if (siguiente !== status) {
      return {
        ok: false,
        error: siguiente
          ? `Desde "${estadoActual}" solo se puede pasar a "${siguiente}".`
          : "Este pedido ya fue entregado.",
      };
    }

    // El filtro por estado evita pisar un cambio hecho al mismo tiempo desde otra pantalla.
    const { data, error } = await supabase
      .from("pedidos")
      .update({ estado: status, updated_at: new Date().toISOString() })
      .eq("id", id)
      .eq("estado", estadoActual)
      .select("id")
      .maybeSingle();

    if (error) return { ok: false, error: schemaError(error.message) };
    if (!data) return { ok: false, error: "El pedido cambió de estado mientras tanto. Volvé al listado y abrilo de nuevo." };
    revalidatePath("/operador");
    return leerPedido(supabase, id);
  });
}

async function cotizacionVigente(supabase: AdminClient) {
  return supabase
    .from("parametros_cotizacion")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();
}

export async function listarParametrosCotizacion(): Promise<Result<{ cotizacion: Cotizacion }>> {
  return seguro("listarParametrosCotizacion", async () => {
    const auth = await requireOperador();
    if (!auth.ok) return auth;

    const { data, error } = await cotizacionVigente(createAdminClient());
    if (error) return { ok: false, error: schemaError(error.message) };
    if (!data) {
      return { ok: false, error: "No hay una cotización cargada. Ejecutá supabase/schema.sql en el SQL Editor." };
    }
    return { ok: true, cotizacion: mapCotizacion(data as CotizacionRow) };
  });
}

export async function guardarParametrosCotizacion(values: CotizacionValues): Promise<Result<{ cotizacion: Cotizacion }>> {
  return seguro("guardarParametrosCotizacion", async () => {
    const auth = await requireOperador();
    if (!auth.ok) return auth;

    const precioMaterialKg = Number(values.precioMaterialKg);
    const energiaImporte = Number(values.energiaImporte);
    const energiaDias = Number(values.energiaDias);
    const valorImpresora = Number(values.valorImpresora);
    const porcentajeMantenimiento = Number(values.porcentajeMantenimiento) / 100;
    const vidaUtilAnos = Number(values.vidaUtilAnos);
    const manoObraHora = Number(values.manoObraHora);
    const porcentajeImpuestos = Number(values.porcentajeImpuestos) / 100;
    const lacaCm3Envase = Number(values.lacaCm3Envase);
    const lacaCm3PorPieza = Number(values.lacaCm3PorPieza);
    const lacaPrecio = Number(values.lacaPrecio);
    const acetonaPrecioCm3 = Number(values.acetonaPrecioCm3);

    const todos = [
      precioMaterialKg, energiaImporte, energiaDias, valorImpresora, porcentajeMantenimiento, vidaUtilAnos,
      manoObraHora, porcentajeImpuestos, lacaCm3Envase, lacaCm3PorPieza, lacaPrecio, acetonaPrecioCm3,
    ];
    if (!todos.every(Number.isFinite)) {
      return { ok: false, error: "Todos los parámetros deben ser números." };
    }

    if (
      !(
        precioMaterialKg > 0 &&
        energiaImporte > 0 &&
        energiaDias > 0 &&
        valorImpresora > 0 &&
        vidaUtilAnos > 0 &&
        manoObraHora > 0
      )
    ) {
      return { ok: false, error: "Completá los valores base con números mayores a 0." };
    }

    if (
      !(
        porcentajeMantenimiento >= 0 &&
        porcentajeImpuestos >= 0 &&
        lacaCm3Envase >= 0 &&
        lacaCm3PorPieza >= 0 &&
        lacaPrecio >= 0 &&
        acetonaPrecioCm3 >= 0
      )
    ) {
      return { ok: false, error: "Los porcentajes y consumibles no pueden ser negativos." };
    }

    const supabase = createAdminClient();
    const { data, error } = await supabase
      .from("parametros_cotizacion")
      .insert({
        precio_material_kg: precioMaterialKg,
        energia_importe: energiaImporte,
        energia_dias: energiaDias,
        valor_impresora: valorImpresora,
        porcentaje_mantenimiento: porcentajeMantenimiento,
        vida_util_anos: vidaUtilAnos,
        mano_obra_hora: manoObraHora,
        porcentaje_impuestos: porcentajeImpuestos,
        laca_cm3_envase: lacaCm3Envase,
        laca_cm3_por_pieza: lacaCm3PorPieza,
        laca_precio: lacaPrecio,
        acetona_precio_cm3: acetonaPrecioCm3,
        updated_at: new Date().toISOString(),
      })
      .select("*")
      .single();

    if (error || !data) return { ok: false, error: schemaError(error?.message ?? "No se pudo guardar la cotización.") };

    revalidatePath("/operador");
    return { ok: true, cotizacion: mapCotizacion(data as CotizacionRow) };
  });
}

// Fecha de hoy en Argentina, para no aceptar entregas en el pasado.
function hoyEnArgentina() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Jujuy" }).format(new Date());
}

// HU-08: calcula el presupuesto con los parámetros vigentes y lo guarda como "Generado".
// Si el pedido ya tiene un presupuesto Generado, lo recalcula en lugar de crear otro.
export async function generarPresupuesto(
  orderId: string,
  options: {
    cantidadMaterial: number;
    tiempoHoras: number;
    cantidadLaca?: number;
    acetonaCm3?: number;
  },
): Promise<Result<{ order: Order }>> {
  return seguro("generarPresupuesto", async () => {
    const auth = await requireOperador();
    if (!auth.ok) return auth;

    const cantidadMaterial = Number(options.cantidadMaterial);
    const tiempoHoras = Number(options.tiempoHoras);
    const cantidadLaca = Number(options.cantidadLaca ?? 0);
    const acetonaCm3 = Number(options.acetonaCm3 ?? 0);
    if (!(cantidadMaterial > 0) || !Number.isFinite(cantidadMaterial)) {
      return { ok: false, error: "La cantidad de material en gramos debe ser mayor a 0." };
    }
    if (!(tiempoHoras > 0) || !Number.isFinite(tiempoHoras)) {
      return { ok: false, error: "El tiempo de impresión debe ser mayor a 0." };
    }
    if (!(cantidadLaca >= 0 && acetonaCm3 >= 0) || !Number.isFinite(cantidadLaca + acetonaCm3)) {
      return { ok: false, error: "Laca y acetona no pueden ser negativas." };
    }

    const supabase = createAdminClient();
    const [pedido, { data: cotizacionRow, error: cotizacionError }] = await Promise.all([
      leerPedido(supabase, orderId),
      cotizacionVigente(supabase),
    ]);

    if (!pedido.ok) return pedido;
    if (cotizacionError || !cotizacionRow) {
      return { ok: false, error: schemaError(cotizacionError?.message ?? "No se encontró la cotización base.") };
    }

    const order = pedido.order;
    if (!requierePresupuesto(order.status)) {
      return { ok: false, error: `El pedido está en "${order.status}" y ya no necesita presupuesto.` };
    }
    if (order.status === "Pendiente de presupuesto" && order.quote?.status === "Disponible") {
      return { ok: false, error: "Este pedido ya tiene un presupuesto disponible y espera la respuesta del cliente." };
    }

    const cotizacion = mapCotizacion(cotizacionRow as CotizacionRow);
    const totalCalculado = calcularPresupuesto(cotizacion, {
      gramos: cantidadMaterial,
      horas: tiempoHoras,
      piezasLaca: cantidadLaca,
      acetonaCm3,
    }).total;
    const valores = {
      id_cotizacion: cotizacion.id,
      cantidad_material: cantidadMaterial,
      tiempo_horas: tiempoHoras,
      cantidad_laca: cantidadLaca,
      acetona_cm3: acetonaCm3,
      total_calculado: totalCalculado,
      total: Math.round(totalCalculado),
    };

    const { error } = order.quote?.status === "Generado"
      ? await supabase.from("presupuestos").update(valores).eq("id", order.quote.id).eq("estado", "Generado")
      : await supabase.from("presupuestos").insert({
          ...valores,
          pedido_id: orderId,
          // Se precarga la fecha estimada del pedido (o hoy, si ya pasó); el operador la ajusta en HU-09.
          fecha_entrega: order.estimatedDate > hoyEnArgentina() ? order.estimatedDate : hoyEnArgentina(),
          estado: "Generado",
        });

    // Error 7 del TP3: el índice único impide dos presupuestos "Generado" para el mismo pedido.
    if (error?.code === "23505") {
      return { ok: false, error: "Otro operador acaba de generar el presupuesto de este pedido. Volvé a elegirlo para ver el actual." };
    }
    if (error) return { ok: false, error: schemaError(error.message) };

    const actualizado = await leerPedido(supabase, orderId);
    if (actualizado.ok) revalidatePath("/operador");
    return actualizado;
  });
}

// HU-09: carga la fecha de entrega, ajusta el monto y deja el presupuesto "Disponible" para el cliente.
// En el mismo paso el sistema pasa el pedido a "Pendiente de seña".
export async function publicarPresupuesto(
  orderId: string,
  options: { fechaEntrega: string; total: number },
): Promise<Result<{ order: Order }>> {
  return seguro("publicarPresupuesto", async () => {
    const auth = await requireOperador();
    if (!auth.ok) return auth;

    const fechaEntrega = String(options.fechaEntrega ?? "").trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega) || Number.isNaN(new Date(`${fechaEntrega}T00:00:00`).getTime())) {
      return { ok: false, error: "Cargá una fecha estimada de entrega válida." };
    }
    if (fechaEntrega < hoyEnArgentina()) {
      return { ok: false, error: "La fecha de entrega no puede ser anterior a hoy." };
    }
    const total = Number(options.total);
    if (!(total > 0) || !Number.isFinite(total)) {
      return { ok: false, error: "El monto del presupuesto debe ser mayor a 0." };
    }

    const supabase = createAdminClient();
    const pedido = await leerPedido(supabase, orderId);
    if (!pedido.ok) return pedido;

    const quote = pedido.order.quote;
    if (quote?.status !== "Generado") {
      return {
        ok: false,
        error: quote
          ? "Este presupuesto ya está disponible para el cliente."
          : "Primero generá el presupuesto del pedido.",
      };
    }

    // Error 6 del TP3: presupuesto y pedido se actualizan juntos en una transacción de PostgreSQL.
    const { data: resultado, error } = await supabase.rpc("publicar_presupuesto", {
      p_presupuesto_id: quote.id,
      p_pedido_id: orderId,
      p_fecha_entrega: fechaEntrega,
      p_total: total,
    });

    if (error) return { ok: false, error: schemaError(error.message) };
    if (resultado !== "ok") {
      return { ok: false, error: "El presupuesto o el pedido cambiaron mientras tanto. Volvé a elegir el pedido." };
    }

    const actualizado = await leerPedido(supabase, orderId);
    if (actualizado.ok) revalidatePath("/operador");
    return actualizado;
  });
}
