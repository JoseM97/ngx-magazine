/**
 * Cálculo del tamaño de letra del globo de cómic para que su texto quepa
 * sin cortarse. Las medidas están en unidades de ancho de la estrella
 * (1 unidad = 1cqw dentro del globo).
 *
 * Prioridad: que cada palabra quepa ENTERA en una línea. Solo si ni con el
 * tamaño mínimo cabe la palabra más larga, se permite partirla en trozos.
 */

/** Ancho máximo del texto dentro de la estrella. */
export const BURST_MAX_WIDTH = 52;
/** Alto máximo del texto dentro de la estrella. */
export const BURST_MAX_HEIGHT = 34;
/** Tamaño de letra máximo y mínimo. */
export const BURST_MAX_FONT = 16;
export const BURST_MIN_FONT = 5;

/** Ancho medio estimado de una letra mayúscula, en em (conservador). */
const CHAR_WIDTH_EM = 0.66;
/** Altura de línea, en em. */
const LINE_HEIGHT_EM = 1.05;
const STEP = 0.5;

/** Número de líneas que ocupa el texto con `capacity` letras por línea. */
export function countBurstLines(text: string, capacity: number): number {
  const words = text.split(/\s+/).filter(Boolean);
  const cap = Math.max(1, Math.floor(capacity));

  let lines = 1;
  let current = 0;

  for (const word of words) {
    const length = word.length;

    if (length <= cap) {
      if (current === 0) {
        current = length;
      } else if (current + 1 + length <= cap) {
        current += 1 + length;
      } else {
        lines++;
        current = length;
      }
      continue;
    }

    // Palabra más larga que una línea: se parte en trozos.
    if (current > 0) {
      lines++;
    }

    const chunks = Math.ceil(length / cap);
    lines += chunks - 1;
    current = length - (chunks - 1) * cap;
  }

  return lines;
}

/** Mayor tamaño de letra (en cqw) con el que el texto cabe en la estrella. */
export function fitBurstFontSize(text: string): number {
  const clean = text.trim();

  if (!clean) {
    return BURST_MAX_FONT;
  }

  const longest = Math.max(...clean.split(/\s+/).map((word) => word.length));

  // 1) Preferido: ninguna palabra se parte.
  for (let size = BURST_MAX_FONT; size >= BURST_MIN_FONT; size -= STEP) {
    const capacity = Math.floor(BURST_MAX_WIDTH / (size * CHAR_WIDTH_EM));

    if (capacity < longest) {
      continue;
    }

    if (countBurstLines(clean, capacity) * size * LINE_HEIGHT_EM <= BURST_MAX_HEIGHT) {
      return size;
    }
  }

  // 2) Respaldo: la palabra más larga no cabe ni al mínimo; se permite partirla.
  for (let size = BURST_MAX_FONT; size >= BURST_MIN_FONT; size -= STEP) {
    const capacity = Math.floor(BURST_MAX_WIDTH / (size * CHAR_WIDTH_EM));

    if (capacity < 1) {
      continue;
    }

    if (countBurstLines(clean, capacity) * size * LINE_HEIGHT_EM <= BURST_MAX_HEIGHT) {
      return size;
    }
  }

  return BURST_MIN_FONT;
}