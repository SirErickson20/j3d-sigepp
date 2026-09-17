"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  generateOrderCode,
  mapCotizacion,
  mapPedido,
  normalizeOrderCode,
} from "@/lib/pedidos/mappers";
import { calcularPresupuesto } from "@/lib/pedidos/calculo";
import {
  COLOR_BY_VALUE,
  ORDER_STATUSES,
  PEDIDO_SELECT,
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
): Promise<{ ok: true; order: Order | null } | { ok: false; error: string }> {
  const codigo = normalizeOrderCode(code);
  if (!codigo) return { ok: true, order: null };

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("pedidos")
    .select(PEDIDO_SELECT)
    .eq("codigo", codigo)
    .maybeSingle();

  if (error) return { ok: false, error: schemaError(error.message) };
  return { ok: true, order: data ? mapPedido(data as PedidoRow) : null };
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
  const { data, error } = await supabase
    .from("pedidos")
    .update({ estado: status, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select(PEDIDO_SELECT)
    .single();

  if (error || !data) return { ok: false, error: schemaError(error?.message ?? "No se pudo actualizar.") };
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

export async function generarPresupuesto(
  orderId: string,
  options: {
    fechaEstimada: string;
    cantidadMaterial: number;
    tiempoHoras: number;
    cantidadLaca?: number;
    acetonaCm3?: number;
    total?: number;
  },
): Promise<{ ok: true; order: Order } | { ok: false; error: string }> {
  const fechaEstimada = options.fechaEstimada.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaEstimada)) {
    return { ok: false, error: "Cargá una fecha estimada de entrega válida." };
  }

  const parsedDate = new Date(`${fechaEstimada}T00:00:00`);
  if (Number.isNaN(parsedDate.getTime())) {
    return { ok: false, error: "Cargá una fecha estimada de entrega válida." };
  }

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
  const [{ data: order, error: orderError }, { data: cotizacionRow, error: cotizacionError }] =
    await Promise.all([
      supabase.from("pedidos").select("*").eq("id", orderId).single(),
      supabase
        .from("parametros_cotizacion")
        .select("*")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

  if (orderError || !order) {
    return { ok: false, error: schemaError(orderError?.message ?? "No se encontró el pedido.") };
  }
  if (cotizacionError || !cotizacionRow) {
    return { ok: false, error: schemaError(cotizacionError?.message ?? "No se encontró la cotización base.") };
  }

  const cotizacion = mapCotizacion(cotizacionRow as CotizacionRow);
  const calculatedTotal = calcularPresupuesto(cotizacion, {
    gramos: cantidadMaterial,
    horas: tiempoHoras,
    piezasLaca: cantidadLaca,
    acetonaCm3,
  }).total;
  const total = options.total == null ? calculatedTotal : Number(options.total);

  if (!(total > 0)) {
    return { ok: false, error: "El monto del presupuesto debe ser mayor a 0." };
  }

  const { error } = await supabase.from("presupuestos").insert({
    pedido_id: orderId,
    id_cotizacion: cotizacion.id,
    cantidad_material: cantidadMaterial,
    tiempo_horas: tiempoHoras,
    cantidad_laca: cantidadLaca,
    acetona_cm3: acetonaCm3,
    fecha_entrega: fechaEstimada,
    total_calculado: calculatedTotal,
    total,
    estado: "Enviado",
  });

  if (error) return { ok: false, error: schemaError(error.message) };

  const { data: updated, error: statusError } = await supabase
    .from("pedidos")
    .update({
      estado: "Pendiente de seña",
      fecha_estimada: fechaEstimada,
      updated_at: new Date().toISOString(),
    })
    .eq("id", orderId)
    .select(PEDIDO_SELECT)
    .single();

  if (statusError || !updated) {
    return { ok: false, error: schemaError(statusError?.message ?? "El presupuesto se guardó, pero no se pudo actualizar el estado.") };
  }

  revalidatePath("/operador");
  revalidatePath("/cliente/consultar-pedido");
  return { ok: true, order: mapPedido(updated as PedidoRow) };
}
