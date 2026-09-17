import type { Cotizacion } from "@/lib/pedidos/types";

const MINUTES_PER_DAY = 1440;
const MINUTES_PER_YEAR = 365 * 24 * 60;

export type PresupuestoInput = {
  gramos: number;
  horas: number;
  piezasLaca: number;
  acetonaCm3: number;
};

export function calcularPresupuesto(cotizacion: Cotizacion, input: PresupuestoInput) {
  const minutos = input.horas * 60;
  const energiaPorMinuto =
    cotizacion.energiaDias > 0 ? cotizacion.energiaImporte / cotizacion.energiaDias / MINUTES_PER_DAY : 0;
  const energia = energiaPorMinuto * minutos;
  const material = (cotizacion.precioMaterialKg / 1000) * input.gramos;
  const laca =
    cotizacion.lacaCm3Envase > 0
      ? (cotizacion.lacaPrecio / cotizacion.lacaCm3Envase) * cotizacion.lacaCm3PorPieza * input.piezasLaca
      : 0;
  const acetona = cotizacion.acetonaPrecioCm3 * input.acetonaCm3;
  const subtotalDirecto = energia + material + laca + acetona;
  const mantenimiento = subtotalDirecto * cotizacion.porcentajeMantenimiento;
  const amortizacionPorMinuto =
    cotizacion.vidaUtilAnos > 0 ? cotizacion.valorImpresora / (cotizacion.vidaUtilAnos * MINUTES_PER_YEAR) : 0;
  const amortizacion = amortizacionPorMinuto * minutos;
  const manoObra = (cotizacion.manoObraHora / 60) * minutos;
  const subtotal = subtotalDirecto + mantenimiento + amortizacion + manoObra;
  const impuestos = subtotal * cotizacion.porcentajeImpuestos;

  return {
    minutos,
    energia,
    material,
    laca,
    acetona,
    subtotalDirecto,
    mantenimiento,
    amortizacion,
    manoObra,
    subtotal,
    impuestos,
    total: subtotal + impuestos,
  };
}
