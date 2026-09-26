"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateOrderCode,
  mapCotizacion,
  mapPedido,
  normalizeOrderCode,
  toClientOrder,
} from "@/lib/pedidos/mappers";
import { calcularPresupuesto } from "@/lib/pedidos/calculo";
import { ESTADOS_QUE_REQUIEREN_PRESUPUESTO, requierePresupuesto, siguienteEstadoManual } from "@/lib/pedidos/estados";
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
  type ProductType,
} from "@/lib/pedidos/types";

const MAX_FILE_BYTES = 5 * 1024 * 1024;
const ALLOWED_FILE_TYPES = ["image/jpeg", "image/png", "application/pdf"];

function missingTable(message: string) {
  return /could not find the table|schema cache|PGRST205/i.test(message);
}

function schemaError(message: string) {
  return missingTable(message) || /could not find the .* column|PGRST204/i.test(message)
    ? "Falta actualizar las tablas en Supabase. Ejecutá supabase/schema.sql en el SQL Editor."
    : message;
}

function asString(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function uploadReference(file: File | null) {
  if (!file || file.size === 0) return { nombre: null as string | null, url: null as string | null };

  if (file.size > MAX_FILE_BYTES) {
    throw new Error("El archivo de referencia no puede superar 5 MB.");
  }

  const extension = file.name.toLowerCase().split(".").pop() ?? "";
  const allowedExtension = ["jpeg", "jpg", "png", "pdf"].includes(extension);
  if (!ALLOWED_FILE_TYPES.includes(file.type) || !allowedExtension) {
    throw new Error("Solo se permiten archivos .jpeg, .png, .jpg o .pdf.");
  }

  const supabase = createAdminClient();
  const path = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const { error } = await supabase.storage.from("referencias").upload(path, file, {
    contentType: file.type,
    upsert: false,
  });

  if (error) {
    return { nombre: file.name, url: null as string | null };
  }

  const { data } = supabase.storage.from("referencias").getPublicUrl(path);
  return { nombre: file.name, url: data.publicUrl };
}

export async function createPedido(
  formData: FormData,
): Promise<{ ok: true; codigo: string } | { ok: false; error: string }> {
  try {
    const producto = asString(formData, "producto") as ProductType;
    const colors = formData
      .getAll("colors")
      .map((value) => COLOR_BY_VALUE[String(value)])
      .filter(Boolean);
    const cantidad = Number(asString(formData, "cantidad") || "1");
    const diseno = asString(formData, "diseno");
    const nombre = asString(formData, "nombre");
    const apellido = asString(formData, "apellido");
    const email = asString(formData, "email");
    const telefono = asString(formData, "telefono");
    const delivery = asString(formData, "delivery") === "shipping" ? "Envío" : "Retiro";
    const domicilio = asString(formData, "domicilio") || null;
    const ciudad = asString(formData, "ciudad") || null;
    const codigoPostal = asString(formData, "codigo_postal") || null;
    const archivo = formData.get("archivo");
    const file = archivo instanceof File ? archivo : null;

    if (!producto || colors.length === 0 || !diseno || !nombre || !apellido || !email || !telefono) {
      return { ok: false, error: "Completá todos los campos obligatorios." };
    }

    if (!/^\d{10}$/.test(telefono)) {
      return { ok: false, error: "El teléfono debe tener exactamente 10 dígitos." };
    }

    if (delivery === "Envío" && (!domicilio || !ciudad || !codigoPostal)) {
      return { ok: false, error: "Completá el domicilio de envío." };
    }

    const uploaded = await uploadReference(file);
    const supabase = createAdminClient();
    const emailNormalizado = email.toLowerCase();

    const { data: cliente, error: clienteError } = await supabase
      .from("clientes")
      .upsert(
        {
          nombre,
          apellido,
          email: emailNormalizado,
          telefono,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "email" },
      )
      .select("id")
      .single();

    if (clienteError || !cliente) {
      return { ok: false, error: schemaError(clienteError?.message ?? "No se pudo guardar el cliente.") };
    }

    let codigo = generateOrderCode();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      const { data, error } = await supabase
        .from("pedidos")
        .insert({
          codigo,
          cliente_id: cliente.id,
          estado: "Pendiente de presupuesto",
          producto,
          colores: colors,
          cantidad,
          diseno,
          archivo_nombre: uploaded.nombre,
          archivo_url: uploaded.url,
          modalidad_entrega: delivery,
          domicilio,
          ciudad,
          codigo_postal: codigoPostal,
        })
        .select("codigo")
        .single();

      if (!error && data) {
        revalidatePath("/operador");
        revalidatePath("/cliente");
        revalidatePath("/cliente/consultar-pedido");
        return { ok: true, codigo: data.codigo };
      }

      if (error?.code === "23505") {
        codigo = generateOrderCode();
        continue;
      }

      return { ok: false, error: schemaError(error?.message ?? "No se pudo guardar el pedido.") };
    }

    return { ok: false, error: "No se pudo generar un código único. Probá de nuevo." };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "No se pudo guardar el pedido.",
    };
  }
}

export async function consultarPedido(
  code: string,
): Promise<{ ok: true; order: ClientOrder | null } | { ok: false; error: string }> {
  const codigo = normalizeOrderCode(code);
  if (!codigo) return { ok: true, order: null };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) return { ok: false, error: schemaError(error.message) };
  return { ok: true, order: data ? toClientOrder(mapPedido(data as PedidoRow)) : null };
}

export async function listarPedidos(): Promise<
  { ok: true; orders: Order[] } | { ok: false; error: string }
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .order("created_at", { ascending: false });

  if (error) return { ok: false, error: schemaError(error.message) };
  return { ok: true, orders: (data as PedidoRow[] | null)?.map(mapPedido) ?? [] };
}

export async function actualizarEstadoPedido(
  id: string,
  status: OrderStatus,
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
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
    .select(PEDIDO_SELECT)
    .maybeSingle();

  if (error) return { ok: false, error: schemaError(error.message) };
  if (!data) return { ok: false, error: "El pedido cambió de estado mientras tanto. Volvé al listado y abrilo de nuevo." };
  revalidatePath("/operador");
  revalidatePath("/cliente/consultar-pedido");
  return { ok: true, order: mapPedido(data as PedidoRow) };
}

export async function listarParametrosCotizacion(): Promise<
  { ok: true; cotizacion: Cotizacion } | { ok: false; error: string }
> {
  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("parametros_cotizacion")
    .select("*")
    .order("updated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: schemaError(error.message) };
  if (!data) {
    return { ok: false, error: "No hay una cotización cargada. Ejecutá supabase/schema.sql en el SQL Editor." };
  }
  return { ok: true, cotizacion: mapCotizacion(data as CotizacionRow) };
}

export async function guardarParametrosCotizacion(
  values: CotizacionValues,
): Promise<{ ok: true; cotizacion: Cotizacion } | { ok: false; error: string }> {
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
}

type PresupuestoResult = { ok: true; order: Order } | { ok: false; error: string };

async function leerPedido(supabase: ReturnType<typeof createAdminClient>, orderId: string) {
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .eq("id", orderId)
    .maybeSingle();
  if (error) return { ok: false as const, error: schemaError(error.message) };
  if (!data) return { ok: false as const, error: "No se encontró el pedido." };
  return { ok: true as const, order: mapPedido(data as PedidoRow) };
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
): Promise<PresupuestoResult> {
  const cantidadMaterial = Number(options.cantidadMaterial);
  const tiempoHoras = Number(options.tiempoHoras);
  const cantidadLaca = Number(options.cantidadLaca ?? 0);
  const acetonaCm3 = Number(options.acetonaCm3 ?? 0);
  if (!(cantidadMaterial > 0)) {
    return { ok: false, error: "La cantidad de material en gramos debe ser mayor a 0." };
  }
  if (!(tiempoHoras > 0)) {
    return { ok: false, error: "El tiempo de impresión debe ser mayor a 0." };
  }
  if (!(cantidadLaca >= 0 && acetonaCm3 >= 0)) {
    return { ok: false, error: "Laca y acetona no pueden ser negativas." };
  }

  const supabase = createAdminClient();
  const [pedido, { data: cotizacionRow, error: cotizacionError }] = await Promise.all([
    leerPedido(supabase, orderId),
    supabase
      .from("parametros_cotizacion")
      .select("*")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
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

  if (error) return { ok: false, error: schemaError(error.message) };

  const actualizado = await leerPedido(supabase, orderId);
  if (actualizado.ok) revalidatePath("/operador");
  return actualizado;
}

// HU-09: carga la fecha de entrega, ajusta el monto y deja el presupuesto "Disponible" para el cliente.
// En el mismo paso el sistema pasa el pedido a "Pendiente de seña".
export async function publicarPresupuesto(
  orderId: string,
  options: { fechaEntrega: string; total: number },
): Promise<PresupuestoResult> {
  const fechaEntrega = options.fechaEntrega.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEntrega) || Number.isNaN(new Date(`${fechaEntrega}T00:00:00`).getTime())) {
    return { ok: false, error: "Cargá una fecha estimada de entrega válida." };
  }
  if (fechaEntrega < hoyEnArgentina()) {
    return { ok: false, error: "La fecha de entrega no puede ser anterior a hoy." };
  }
  const total = Number(options.total);
  if (!(total > 0)) {
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

  // El filtro por estado evita publicar dos veces el mismo presupuesto.
  const { data: publicado, error } = await supabase
    .from("presupuestos")
    .update({ fecha_entrega: fechaEntrega, total, estado: "Disponible" })
    .eq("id", quote.id)
    .eq("estado", "Generado")
    .select("id")
    .maybeSingle();

  if (error) return { ok: false, error: schemaError(error.message) };
  if (!publicado) return { ok: false, error: "El presupuesto cambió mientras tanto. Volvé a elegir el pedido." };

  const { error: pedidoError } = await supabase
    .from("pedidos")
    .update({ estado: "Pendiente de seña", fecha_estimada: fechaEntrega, updated_at: new Date().toISOString() })
    .eq("id", orderId)
    .in("estado", ESTADOS_QUE_REQUIEREN_PRESUPUESTO);

  if (pedidoError) {
    return { ok: false, error: schemaError(`El presupuesto quedó disponible, pero no se pudo actualizar el pedido: ${pedidoError.message}`) };
  }

  const actualizado = await leerPedido(supabase, orderId);
  if (actualizado.ok) {
    revalidatePath("/operador");
    revalidatePath("/cliente/consultar-pedido");
  }
  return actualizado;
}
