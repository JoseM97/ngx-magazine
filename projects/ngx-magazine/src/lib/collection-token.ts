import { InjectionToken, Signal } from '@angular/core';

/**
 * Fases de la interacción con una revista de la colección.
 * - `idle`: ninguna revista seleccionada.
 * - `entering`: la modal aparece con la revista cerrada, centrada.
 * - `shown`: la modal está visible y la revista, cerrada, espera a que el
 *   usuario la abra (›, o clic en la portada).
 * - `opening`: la tapa gira y el libro se centra en el pliego.
 * - `reading`: la revista se ha abierto al menos una vez; se puede navegar
 *   (y volver a la portada, que cierra el libro sin salir de la modal).
 * - `closing`: la revista vuelve a la portada y se cierra.
 * - `leaving`: la modal se cierra y la revista vuelve a la mesa.
 */
export type MagazinePhase =
  | 'idle'
  | 'entering'
  | 'shown'
  | 'opening'
  | 'reading'
  | 'closing'
  | 'leaving';

/**
 * Contrato mínimo que un item necesita de la colección que lo contiene.
 * Evita una dependencia circular entre item y colección.
 */
export interface MagazineCollectionHost {
  readonly selectedId: Signal<string | null>;
  readonly phase: Signal<MagazinePhase>;
  select(id: string): void;
  close(): void;
  /** La animación de entrada de la modal terminó. */
  finishEnter(): void;
  /** El usuario ha empezado a abrir la revista. */
  startOpen(): void;
  /** La tapa terminó de abrirse: empieza la lectura. */
  finishOpen(): void;
  /** La revista terminó de cerrarse y volvió a centrarse. */
  finishClosing(): void;
  /** La animación de salida terminó: se libera la selección. */
  finishLeave(): void;
}

export const MAGAZINE_COLLECTION = new InjectionToken<MagazineCollectionHost>(
  'MAGAZINE_COLLECTION',
);