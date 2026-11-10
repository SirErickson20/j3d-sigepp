// Reglas de validación del pedido personalizado (HU-03).
// Las usan el formulario del cliente y la acción del servidor: el servidor nunca confía en el navegador.

import { PRODUCT_TYPES, type ProductType } from "@/lib/pedidos/types";

export const CANTIDAD_MINIMA = 1;
export const CANTIDAD_MAXIMA = 500;
export const DIGITOS_TELEFONO = 10;
export const MAX_ARCHIVO_BYTES = 5 * 1024 * 1024;
export const MAX_LARGO_TEXTO = 120;
export const MAX_LARGO_DISENO = 2000;

export const EXTENSIONES_PERMITIDAS = ["jpeg", "jpg", "png", "pdf"] as const;
export const ACCEPT_ARCHIVO = ".jpeg,.jpg,.png,.pdf";
export const MENSAJE_ARCHIVO_INVALIDO = "Solo se permiten archivos .jpeg, .png, .jpg o .pdf.";

// Formato de email simple: algo@dominio.ext, sin espacios.
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export function esProductoValido(value: string): value is ProductType {
  return (PRODUCT_TYPES as readonly string[]).includes(value);
}

export function esEmailValido(value: string) {
  return value.length <= 254 && EMAIL_REGEX.test(value);
}

export function esTelefonoValido(value: string) {
  return new RegExp(`^\\d{${DIGITOS_TELEFONO}}$`).test(value);
}

export function esCantidadValida(value: number) {
  return Number.isInteger(value) && value >= CANTIDAD_MINIMA && value <= CANTIDAD_MAXIMA;
}

export function extensionDe(nombre: string) {
  const partes = nombre.toLowerCase().split(".");
  return partes.length > 1 ? partes.pop() ?? "" : "";
}

export function tieneExtensionPermitida(nombre: string) {
  return (EXTENSIONES_PERMITIDAS as readonly string[]).includes(extensionDe(nombre));
}

// Petición de cambio 005/26: algunos celulares (por ejemplo, al compartir una foto de WhatsApp)
// envían el archivo sin tipo MIME. Por eso el tipo se reconoce por el contenido real del archivo
// (sus primeros bytes) y no por lo que informa el navegador.
export type TipoArchivo = "image/jpeg" | "image/png" | "application/pdf";

export function detectarTipoArchivo(bytes: Uint8Array): TipoArchivo | null {
  if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return "image/jpeg";
  if (
    bytes.length >= 8 &&
    bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47 &&
    bytes[4] === 0x0d && bytes[5] === 0x0a && bytes[6] === 0x1a && bytes[7] === 0x0a
  ) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 0x25 && bytes[1] === 0x50 && bytes[2] === 0x44 && bytes[3] === 0x46) return "application/pdf";
  return null;
}

export const EXTENSION_POR_TIPO: Record<TipoArchivo, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "application/pdf": "pdf",
};
