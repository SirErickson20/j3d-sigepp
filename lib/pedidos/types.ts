export const ORDER_STATUSES = [
  "Pendiente de presupuesto",
  "En rediseño",
  "Pendiente de seña",
  "En producción",
  "Finalizado",
  "Pendiente de saldo",
  "Entregado",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];
export type Filter = "Todos" | OrderStatus;
export type ProductType =
  | "Mate"
  | "Llavero"
  | "Medalla"
  | "Vaso"
  | "Juguete"
  | "Maceta"
  | "Soporte"
  | "Otros";
export type Color =
  | "Rojo"
  | "Azul"
  | "Amarillo"
  | "Verde"
  | "Naranja"
  | "Violeta"
  | "Blanco"
  | "Negro"
  | "Otros";

export type Order = {
  id: string;
  code: string;
  customer: string;
  email: string;
  phone: string;
  address?: string;
  city?: string;
  postalCode?: string;
  product: ProductType;
  colors: Color[];
  quantity: number;
  designDescription: string;
  referenceFile?: string;
  referenceUrl?: string;
  delivery: "Retiro" | "Envío";
  date: string;
  estimatedDate: string;
  status: OrderStatus;
  createdAt: string;
  quote?: Quote;
};

// Estados del presupuesto según el TP: Generado (HU-08) y Disponible (HU-09).
export const QUOTE_STATUSES = ["Generado", "Disponible"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];

// Último presupuesto del pedido, tal como lo ve el operador.
export type Quote = {
  id: string;
  status: QuoteStatus;
  total: number;
  calculatedTotal: number;
  deliveryDate: string;
  deliveryDateLabel: string;
  materialGrams: number;
  printHours: number;
  lacquerPieces: number;
  acetoneCm3: number;
};

// Lo que ve el cliente (HU-06 y HU-10): solo un presupuesto Disponible, sin el detalle de costos.
export type ClientQuote = {
  total: number;
  deliveryDateLabel: string;
};

export type ClientOrder = Omit<Order, "quote"> & { quote?: ClientQuote };

export type Cotizacion = {
  id: string;
  precioMaterialKg: number;
  energiaImporte: number;
  energiaDias: number;
  valorImpresora: number;
  porcentajeMantenimiento: number;
  vidaUtilAnos: number;
  manoObraHora: number;
  porcentajeImpuestos: number;
  lacaCm3Envase: number;
  lacaCm3PorPieza: number;
  lacaPrecio: number;
  acetonaPrecioCm3: number;
  updated: string;
};

export type CotizacionRow = {
  id: string;
  precio_material_kg: number | string;
  energia_importe: number | string;
  energia_dias: number | string;
  valor_impresora: number | string;
  porcentaje_mantenimiento: number | string;
  vida_util_anos: number | string;
  mano_obra_hora: number | string;
  porcentaje_impuestos: number | string;
  laca_cm3_envase: number | string;
  laca_cm3_por_pieza: number | string;
  laca_precio: number | string;
  acetona_precio_cm3: number | string;
  updated_at: string;
};

export type CotizacionValues = {
  precioMaterialKg: string;
  energiaImporte: string;
  energiaDias: string;
  valorImpresora: string;
  porcentajeMantenimiento: string;
  vidaUtilAnos: string;
  manoObraHora: string;
  porcentajeImpuestos: string;
  lacaCm3Envase: string;
  lacaCm3PorPieza: string;
  lacaPrecio: string;
  acetonaPrecioCm3: string;
};

export const COTIZACION_FIELDS = [
  { key: "energiaImporte", label: "Importe de factura de energía", unit: "ARS", min: 0.01 },
  { key: "energiaDias", label: "Días de la factura", unit: "días", min: 0.01 },
  { key: "precioMaterialKg", label: "Precio de material", unit: "ARS / kg", min: 0.01 },
  { key: "valorImpresora", label: "Valor de la impresora", unit: "ARS", min: 0.01 },
  { key: "porcentajeMantenimiento", label: "Mantenimiento / reinversión", unit: "%", min: 0 },
  { key: "vidaUtilAnos", label: "Vida útil para amortización", unit: "años", min: 0.01 },
  { key: "manoObraHora", label: "Honorarios", unit: "ARS / hora", min: 0.01 },
  { key: "porcentajeImpuestos", label: "Impuestos", unit: "%", min: 0 },
  { key: "lacaCm3Envase", label: "Laca: contenido del envase", unit: "cm³", min: 0 },
  { key: "lacaCm3PorPieza", label: "Laca: consumo por pieza", unit: "cm³", min: 0 },
  { key: "lacaPrecio", label: "Laca: precio del envase", unit: "ARS", min: 0 },
  { key: "acetonaPrecioCm3", label: "Acetona", unit: "ARS / cm³", min: 0 },
] as const;

export type CotizacionFieldKey = (typeof COTIZACION_FIELDS)[number]["key"];

export type ClienteRow = {
  id: string;
  nombre: string;
  apellido: string;
  email: string;
  telefono: string;
};

export type PedidoRow = {
  id: string;
  codigo: string;
  cliente_id: string;
  estado: OrderStatus;
  producto: ProductType;
  colores: string[];
  cantidad: number;
  diseno: string;
  archivo_nombre: string | null;
  archivo_url: string | null;
  modalidad_entrega: "Retiro" | "Envío";
  fecha_estimada: string;
  domicilio: string | null;
  ciudad: string | null;
  codigo_postal: string | null;
  created_at: string;
  clientes: ClienteRow | ClienteRow[] | null;
  presupuestos?: PresupuestoRow[] | PresupuestoRow | null;
};

export type PresupuestoRow = {
  id: string;
  estado: string;
  total: number | string;
  total_calculado: number | string;
  fecha_entrega: string;
  cantidad_material: number | string;
  tiempo_horas: number | string;
  cantidad_laca: number | string;
  acetona_cm3: number | string;
  created_at: string;
};

export const PEDIDO_SELECT = `
  *,
  clientes (
    id,
    nombre,
    apellido,
    email,
    telefono
  ),
  presupuestos (
    id,
    estado,
    total,
    total_calculado,
    fecha_entrega,
    cantidad_material,
    tiempo_horas,
    cantidad_laca,
    acetona_cm3,
    created_at
  )
`;

export const COLOR_BY_VALUE: Record<string, Color> = {
  red: "Rojo",
  blue: "Azul",
  yellow: "Amarillo",
  green: "Verde",
  orange: "Naranja",
  violet: "Violeta",
  white: "Blanco",
  black: "Negro",
  other: "Otros",
};
