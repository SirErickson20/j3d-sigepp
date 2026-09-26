import type {
  ClienteRow,
  ClientOrder,
  Color,
  Cotizacion,
  CotizacionRow,
  Order,
  PedidoRow,
  PresupuestoRow,
  Quote,
} from "@/lib/pedidos/types";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "2-digit",
  month: "short",
  year: "numeric",
});

export function formatOrderDate(value: string) {
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return dateFormatter.format(date).replace(".", "");
}

function mapCliente(cliente: PedidoRow["clientes"]): ClienteRow {
  const row = Array.isArray(cliente) ? cliente[0] : cliente;
  if (!row) {
    return { id: "", nombre: "", apellido: "", email: "", telefono: "" };
  }
  return row;
}

export function mapPedido(row: PedidoRow): Order {
  const cliente = mapCliente(row.clientes);
  const quotes = Array.isArray(row.presupuestos)
    ? row.presupuestos
    : row.presupuestos
      ? [row.presupuestos]
      : [];
  const latestQuote = [...quotes].sort((a, b) => b.created_at.localeCompare(a.created_at))[0];
  return {
    id: row.id,
    code: row.codigo,
    customer: `${cliente.nombre} ${cliente.apellido}`.trim(),
    email: cliente.email,
    phone: cliente.telefono,
    address: row.domicilio ?? undefined,
    city: row.ciudad ?? undefined,
    postalCode: row.codigo_postal ?? undefined,
    product: row.producto,
    colors: row.colores as Color[],
    quantity: row.cantidad,
    designDescription: row.diseno,
    referenceFile: row.archivo_nombre ?? undefined,
    referenceUrl: row.archivo_url ?? undefined,
    delivery: row.modalidad_entrega,
    date: formatOrderDate(row.fecha_estimada),
    estimatedDate: row.fecha_estimada?.slice(0, 10) ?? "",
    status: row.estado,
    createdAt: row.created_at,
    quote: latestQuote ? mapPresupuesto(latestQuote) : undefined,
  };
}

function mapPresupuesto(row: PresupuestoRow): Quote {
  const deliveryDate = row.fecha_entrega?.slice(0, 10) ?? "";
  return {
    id: row.id,
    status: row.estado === "Disponible" ? "Disponible" : "Generado",
    total: Number(row.total),
    calculatedTotal: Number(row.total_calculado),
    deliveryDate,
    deliveryDateLabel: formatOrderDate(deliveryDate),
    materialGrams: Number(row.cantidad_material),
    printHours: Number(row.tiempo_horas),
    lacquerPieces: Number(row.cantidad_laca),
    acetoneCm3: Number(row.acetona_cm3),
  };
}

// HU-10: el cliente solo ve el presupuesto cuando está Disponible, y sin el detalle de costos.
export function toClientOrder(order: Order): ClientOrder {
  const { quote, ...rest } = order;
  return quote?.status === "Disponible"
    ? { ...rest, quote: { total: quote.total, deliveryDateLabel: quote.deliveryDateLabel } }
    : rest;
}

export function mapCotizacion(row: CotizacionRow): Cotizacion {
  return {
    id: row.id,
    precioMaterialKg: Number(row.precio_material_kg),
    energiaImporte: Number(row.energia_importe),
    energiaDias: Number(row.energia_dias),
    valorImpresora: Number(row.valor_impresora),
    porcentajeMantenimiento: Number(row.porcentaje_mantenimiento),
    vidaUtilAnos: Number(row.vida_util_anos),
    manoObraHora: Number(row.mano_obra_hora),
    porcentajeImpuestos: Number(row.porcentaje_impuestos),
    lacaCm3Envase: Number(row.laca_cm3_envase),
    lacaCm3PorPieza: Number(row.laca_cm3_por_pieza),
    lacaPrecio: Number(row.laca_precio),
    acetonaPrecioCm3: Number(row.acetona_precio_cm3),
    updated: formatOrderDate(row.updated_at.slice(0, 10)),
  };
}

export function cotizacionToFormValues(cotizacion: Cotizacion) {
  return {
    precioMaterialKg: String(cotizacion.precioMaterialKg),
    energiaImporte: String(cotizacion.energiaImporte),
    energiaDias: String(cotizacion.energiaDias),
    valorImpresora: String(cotizacion.valorImpresora),
    porcentajeMantenimiento: String(cotizacion.porcentajeMantenimiento * 100),
    vidaUtilAnos: String(cotizacion.vidaUtilAnos),
    manoObraHora: String(cotizacion.manoObraHora),
    porcentajeImpuestos: String(cotizacion.porcentajeImpuestos * 100),
    lacaCm3Envase: String(cotizacion.lacaCm3Envase),
    lacaCm3PorPieza: String(cotizacion.lacaCm3PorPieza),
    lacaPrecio: String(cotizacion.lacaPrecio),
    acetonaPrecioCm3: String(cotizacion.acetonaPrecioCm3),
  };
}

export function generateOrderCode() {
  return `A${Math.floor(1000 + Math.random() * 9000)}`;
}

export function normalizeOrderCode(value: string) {
  return value.trim().toUpperCase().replace(/^#/, "");
}
