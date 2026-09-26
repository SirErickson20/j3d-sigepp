import { ORDER_STATUSES, type OrderStatus } from "@/lib/pedidos/types";

// En estos estados el pedido espera su presupuesto. De acá lo saca el sistema:
// al dejar el presupuesto Disponible (HU-09) pasa a "Pendiente de seña".
export const ESTADOS_QUE_REQUIEREN_PRESUPUESTO: readonly OrderStatus[] = [
  "Pendiente de presupuesto",
  "En rediseño",
];

export function requierePresupuesto(status: OrderStatus) {
  return ESTADOS_QUE_REQUIEREN_PRESUPUESTO.includes(status);
}

// Próxima etapa a la que el operador puede mover el pedido a mano (HU-05).
export function siguienteEstadoManual(status: OrderStatus): OrderStatus | undefined {
  if (requierePresupuesto(status)) return undefined;
  const index = ORDER_STATUSES.indexOf(status);
  return index === -1 ? undefined : ORDER_STATUSES[index + 1];
}
