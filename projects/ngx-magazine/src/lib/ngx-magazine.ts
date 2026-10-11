import {
  Component,
  DestroyRef,
  ElementRef,
  Injector,
  TemplateRef,
  afterNextRender,
  computed,
  contentChildren,
  inject,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { NgTemplateOutlet } from '@angular/common';
import { MAGAZINE_COLLECTION } from './collection-token';
import { MagazinePage } from './magazine-page';

export interface MagazinePageChangeEvent {
  currentSpread: number;
  totalSpreads: number;
  leftPage: number | null;
  rightPage: number | null;
}

export type FlipDirection = 'next' | 'previous';

/**
 * Estado de la tapa de la revista.
 * - `closed`: cerrada, con la portada centrada.
 * - `opening`: la portada gira como una tapa y el libro se centra.
 * - `open`: abierta; se puede navegar.
 * - `closing`: la tapa vuelve a cerrarse y el libro se descentra.
 */
export type MagazineState = 'closed' | 'opening' | 'open' | 'closing';

export interface FlipState {
  direction: FlipDirection;
  frontPage: number;
  backPage: number;
  targetSpread: number;
  progress: boolean;
}

/**
 * Qué página ocupa cada ranura visible en un instante dado.
 * Invariante: ningún índice aparece en más de una ranura.
 */
export interface MagazineComposition {
  /** Capa estática, mitad izquierda. */
  left: number | null;
  /** Capa estática, mitad derecha (o portada si está cerrada). */
  right: number | null;
  /** Cara visible al inicio de la hoja que gira. */
  front: number | null;
  /** Cara que queda visible al terminar la hoja que gira. */
  back: number | null;
}

/** Debe coincidir con `transition: transform 650ms` de los estilos. */
const FLIP_DURATION_MS = 650;
/** Si `transitionend` no llega, el giro se completa igualmente. */
const FLIP_FALLBACK_MS = FLIP_DURATION_MS + 400;

/**
 * El contenido de cada página es del consumidor: texto, imágenes, vídeo o
 * componentes. La librería solo le da una caja del tamaño de la página.
 *
 * Abrir y cerrar la revista son giros de la portada (pliego 0 ↔ 1) con una
 * traslación simultánea del libro: cerrado queda centrado, abierto ocupa el
 * pliego completo.
 *
 * Variables CSS opcionales:
 * - `--ngx-magazine-max-width`: ancho máximo (por defecto 900px).
 * - `--ngx-magazine-background`: fondo de la revista (por defecto #e8e3dc).
 * - `--ngx-magazine-overflow`: overflow del contenedor (por defecto hidden).
 * - `--ngx-magazine-paper`: color de fondo de las páginas (por defecto white).
 * - `--ngx-magazine-page-shadow`: sombra de las páginas estáticas.
 * - `--ngx-magazine-face-shadow`: sombra de las caras de la hoja que gira.
 * - `--ngx-magazine-radius`: radio de las esquinas exteriores de las páginas
 *   (por defecto 3px; 0 dentro de una colección).
 * - `--ngx-magazine-controls-space`: espacio reservado bajo el libro para
 *   los controles (por defecto 56px).
 */
@Component({
  selector: 'ngx-magazine',
  standalone: true,
  imports: [NgTemplateOutlet],
  template: `
    <div class="magazine-wrap">
      <div class="magazine" [class.is-open]="isOpen()" [class.is-embedded]="embedded">
        <div class="magazine__content" [class.is-shifted]="shifted()">
          @let c = composition();

          @if (c.left !== null) {
            <div
              class="magazine__static-page magazine__left"
              [attr.data-page-index]="c.left"
            >
              <ng-container [ngTemplateOutlet]="pageTemplate(c.left)" />
            </div>
          }

          @if (c.right !== null) {
            <div
              class="magazine__static-page magazine__right"
              [class.magazine__front-cover]="c.right === 0"
              [class.is-openable]="embedded && canOpenNow()"
              [attr.data-page-index]="c.right"
              (click)="onCoverClick()"
            >
              <ng-container [ngTemplateOutlet]="pageTemplate(c.right)" />
            </div>
          }

          @if (flip(); as f) {
            <div
              #sheet
              class="magazine__flipping-sheet"
              [class.flip-next]="f.direction === 'next'"
              [class.flip-previous]="f.direction === 'previous'"
              [class.is-flipping]="f.progress"
              aria-hidden="true"
              inert
              (transitionend)="finishFlip($event)"
            >
              <div
                class="magazine__face magazine__face--front"
                [class.magazine__front-cover]="c.front === 0"
              >
                @if (c.front !== null) {
                  <div class="magazine__face-content" [attr.data-page-index]="c.front">
                    <ng-container [ngTemplateOutlet]="pageTemplate(c.front)" />
                  </div>
                }
              </div>

              <div
                class="magazine__face magazine__face--back"
                [class.magazine__front-cover]="c.back === 0"
              >
                @if (c.back !== null) {
                  <div class="magazine__face-content" [attr.data-page-index]="c.back">
                    <ng-container [ngTemplateOutlet]="pageTemplate(c.back)" />
                  </div>
                }
              </div>
            </div>
          }
        </div>

        @if (!embedded && state() === 'closed') {
          <button
            type="button"
            class="magazine__open"
            (click)="open()"
            [disabled]="pages().length < 2"
          >
            Abrir revista
          </button>
        }
      </div>

      @if (isOpen() || embedded) {
        <div class="magazine__controls">
          <button
            type="button"
            class="magazine__previous"
            [disabled]="!canGoPrevious() || isAnimating()"
            (click)="previousSpread()"
            aria-label="Previous spread"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M15 5l-7 7 7 7" /></svg>
          </button>

          <div class="magazine__counter" aria-live="polite">
            @if (leftPage() !== null) {
              {{ leftPage()! + 1 }}
            }
            @if (leftPage() !== null && rightPage() !== null) {
              –
            }
            @if (rightPage() !== null) {
              {{ rightPage()! + 1 }}
            }
            <span>/ {{ pages().length }}</span>
          </div>

          <button
            type="button"
            class="magazine__next"
            [disabled]="nextDisabled()"
            (click)="onNext()"
            [attr.aria-label]="state() === 'closed' ? 'Open magazine' : 'Next spread'"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 5l7 7-7 7" /></svg>
          </button>
        </div>
      }
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    /* Reserva el espacio de los controles bajo el libro. */
    .magazine-wrap {
      position: relative;
      width: 100%;
      max-width: var(--ngx-magazine-max-width, 900px);
      margin: 0 auto;
      padding-bottom: var(--ngx-magazine-controls-space, 56px);
    }

    .magazine {
      --r: var(--ngx-magazine-radius, 3px);
      --paper: var(--ngx-magazine-paper, white);

      position: relative;
      width: 100%;
      aspect-ratio: 3 / 2;
      overflow: var(--ngx-magazine-overflow, hidden);
      background: var(--ngx-magazine-background, #e8e3dc);
    }

    /*
     * La perspectiva vive aquí (padre directo de la hoja) y este elemento
     * NO usa preserve-3d: las páginas estáticas y la hoja se apilan con
     * z-index normal, sin ordenamiento por profundidad entre ellas.
     *
     * El pliego se dibuja siempre completo (lomo en el centro). Con la
     * revista cerrada se desplaza un 25 % a la izquierda para que la
     * portada (mitad derecha) quede centrada. Al abrir o cerrar, esta
     * traslación se anima a la vez que gira la tapa (misma duración y curva).
     */
    .magazine__content {
      position: relative;
      width: 100%;
      height: 100%;
      perspective: 1800px;
      transform: translateX(0);
      transition: transform 650ms ease-in-out;
    }

    .magazine__content.is-shifted {
      transform: translateX(-25%);
    }

    /*
     * Cada página es una caja del tamaño exacto de la página. Su contenido
     * (texto, imágenes, vídeo, componentes) no se modifica: se coloca con
     * normalidad dentro de ella.
     */
    .magazine__static-page {
      position: absolute;
      top: 0;
      width: 50%;
      height: 100%;
      overflow: hidden;
      box-sizing: border-box;
      background: var(--paper);
      box-shadow: var(--ngx-magazine-page-shadow, 0 1px 4px rgb(0 0 0 / 15%));
    }

    /* La geometría la decide la ranura, nunca el índice de la página. */
    .magazine__static-page.magazine__left {
      left: 0;
      border-radius: var(--r) 0 0 var(--r);
    }

    .magazine__static-page.magazine__right {
      left: 50%;
      border-radius: 0 var(--r) var(--r) 0;
    }

    /* Portada cerrada dentro de una colección: un clic la abre. */
    .magazine__static-page.is-openable {
      cursor: pointer;
    }

    .magazine__face-content {
      display: block;
      width: 100%;
      height: 100%;
    }

    /*
     * Sombra del lomo: cada página se oscurece hacia el centro del pliego.
     * Es una capa decorativa que no recibe eventos (no bloquea vídeos ni
     * enlaces del contenido).
     */
    .magazine__static-page::after,
    .magazine__face::after {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }

    .magazine__static-page.magazine__left::after {
      background: linear-gradient(
        270deg,
        rgb(0 0 0 / 26%),
        rgb(0 0 0 / 7%) 8%,
        transparent 18%
      );
    }

    .magazine__static-page.magazine__right::after {
      background: linear-gradient(
        90deg,
        rgb(0 0 0 / 26%),
        rgb(0 0 0 / 7%) 8%,
        transparent 18%
      );
    }

    /*
     * Portada (página 0): surco y brillo junto al lomo. Se aplica por el
     * índice de la página, no por su posición, así que se conserva cerrada,
     * durante la apertura y el cierre, y al volver a ella. Va después de las
     * reglas por posición para ganarles a igual especificidad.
     */
    .magazine__static-page.magazine__front-cover::after,
    .magazine__flipping-sheet .magazine__face.magazine__front-cover::after {
      background: linear-gradient(
        90deg,
        rgb(0 0 0 / 32%),
        rgb(255 255 255 / 14%) 3%,
        rgb(0 0 0 / 10%) 5%,
        transparent 12%
      );
    }

    .magazine__flipping-sheet {
      position: absolute;
      top: 0;
      left: 50%;
      width: 50%;
      height: 100%;
      z-index: 5;
      transform-style: preserve-3d;
      will-change: transform;
      pointer-events: none;
      transition: transform 650ms ease-in-out;
    }

    .magazine__flipping-sheet.flip-previous {
      left: 0;
      transform-origin: right center;
    }

    .magazine__flipping-sheet.flip-next {
      transform-origin: left center;
    }

    .magazine__flipping-sheet.flip-next.is-flipping {
      transform: rotateY(-180deg);
    }

    .magazine__flipping-sheet.flip-previous.is-flipping {
      transform: rotateY(180deg);
    }

    .magazine__face {
      position: absolute;
      inset: 0;
      overflow: hidden;
      background: var(--paper);
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
      box-shadow: var(--ngx-magazine-face-shadow, 0 1px 6px rgb(0 0 0 / 15%));
    }

    .magazine__face--back {
      transform: rotateY(180deg);
    }

    /*
     * Cada cara representa una página del pliego: la que acaba a la derecha
     * (página derecha) o a la izquierda. Eso fija su radio y la sombra del
     * lomo, que va siempre en el lado del centro.
     */
    .flip-next .magazine__face--front,
    .flip-previous .magazine__face--back {
      border-radius: 0 var(--r) var(--r) 0;
    }

    .flip-next .magazine__face--back,
    .flip-previous .magazine__face--front {
      border-radius: var(--r) 0 0 var(--r);
    }

    .flip-next .magazine__face--front::after,
    .flip-previous .magazine__face--back::after {
      background: linear-gradient(
        90deg,
        rgb(0 0 0 / 26%),
        rgb(0 0 0 / 7%) 8%,
        transparent 18%
      );
    }

    .flip-next .magazine__face--back::after,
    .flip-previous .magazine__face--front::after {
      background: linear-gradient(
        270deg,
        rgb(0 0 0 / 26%),
        rgb(0 0 0 / 7%) 8%,
        transparent 18%
      );
    }

    /* Sombreado que cruza la hoja: oscurece hacia la mitad del giro. */
    .magazine__face::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 3;
      pointer-events: none;
      opacity: 0;
      background: rgb(0 0 0 / 30%);
    }

    .is-flipping .magazine__face::before {
      animation: ngx-flip-shade 650ms ease-in-out;
    }

    @keyframes ngx-flip-shade {
      0% {
        opacity: 0;
      }
      50% {
        opacity: 1;
      }
      100% {
        opacity: 0;
      }
    }

    /* Botón «Abrir revista» (solo revista individual). */
    .magazine__open {
      position: absolute;
      z-index: 10;
      left: 50%;
      bottom: 20px;
      padding: 10px 18px;
      border: 0;
      border-radius: 4px;
      transform: translateX(-50%);
      background: #333;
      color: white;
      cursor: pointer;
    }

    .magazine__open:disabled {
      opacity: 0.4;
      cursor: not-allowed;
    }

    /*
     * Controles: una píldora de cristal oscuro, debajo del libro, con
     * iconos de trazo fino. No tapan el contenido de las páginas.
     */
    .magazine__controls {
      position: absolute;
      z-index: 10;
      left: 50%;
      bottom: 8px;
      transform: translateX(-50%);
      display: inline-flex;
      align-items: center;
      gap: 2px;
      padding: 4px;
      border-radius: 999px;
      background: rgb(18 18 18 / 62%);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      box-shadow: 0 4px 16px rgb(0 0 0 / 25%);
      color: #fff;
      font: 500 13px/1 system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif;
    }

    .magazine__previous,
    .magazine__next {
      display: grid;
      place-items: center;
      width: 32px;
      height: 32px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: transparent;
      color: inherit;
      cursor: pointer;
      transition: background 150ms ease-out;
    }

    .magazine__previous svg,
    .magazine__next svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
      stroke-linejoin: round;
    }

    .magazine__previous:hover:not(:disabled),
    .magazine__next:hover:not(:disabled) {
      background: rgb(255 255 255 / 18%);
    }

    .magazine__previous:focus-visible,
    .magazine__next:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 1px;
    }

    .magazine__previous:disabled,
    .magazine__next:disabled {
      opacity: 0.3;
      cursor: not-allowed;
    }

    .magazine__counter {
      min-width: 64px;
      padding: 0 6px;
      text-align: center;
      font-variant-numeric: tabular-nums;
      white-space: nowrap;
    }

    .magazine__counter span {
      margin-left: 0.25em;
      opacity: 0.6;
    }

    /* Dentro de una colección: esquinas rectas por defecto. */
    .magazine.is-embedded {
      --r: var(--ngx-magazine-radius, 0px);
    }

    @media (prefers-reduced-motion: reduce) {
      .magazine__content,
      .magazine__flipping-sheet {
        transition-duration: 1ms;
      }

      .magazine__previous,
      .magazine__next {
        transition: none;
      }

      .is-flipping .magazine__face::before {
        animation: none;
      }
    }
  `,
})
export class NgxMagazine {
  private readonly injector = inject(Injector);
  private readonly destroyRef = inject(DestroyRef);
  private readonly sheet = viewChild<ElementRef<HTMLElement>>('sheet');

  private readonly collection = inject(MAGAZINE_COLLECTION, { optional: true });

  /** Dentro de una colección, la abre el usuario desde la modal. */
  protected readonly embedded = this.collection !== null;

  private flipToken = 0;
  private fallbackTimer: ReturnType<typeof setTimeout> | null = null;

  readonly pages = contentChildren(MagazinePage);

  /** `true` desde que se pide abrir hasta que se pide cerrar. */
  readonly isOpen = signal(false);
  readonly currentSpread = signal(0);
  readonly flip = signal<FlipState | null>(null);
  /** Estado de la tapa: cerrada, abriéndose, abierta o cerrándose. */
  readonly state = signal<MagazineState>('closed');

  private readonly flipping = signal(false);

  /** `true` mientras gira una hoja (también la tapa al abrir o cerrar). */
  readonly isAnimating = computed(
    () =>
      this.flipping() ||
      this.state() === 'opening' ||
      this.state() === 'closing',
  );

  /**
   * `true` si el libro debe dibujarse desplazado (portada centrada). Cambia
   * a la vez que arranca el giro de la tapa para que ambos vayan sincronizados.
   */
  protected readonly shifted = computed(() => {
    const progress = this.flip()?.progress ?? false;

    switch (this.state()) {
      case 'closed':
        return true;
      case 'opening':
        return !progress;
      case 'closing':
        return progress;
      default:
        return false;
    }
  });

  /**
   * La revista cerrada se puede abrir. Dentro de una colección, solo cuando
   * la modal ya está visible.
   */
  protected readonly canOpenNow = computed(() => {
    if (this.pages().length < 2 || this.state() !== 'closed') {
      return false;
    }

    if (!this.collection) {
      return true;
    }

    const phase = this.collection.phase();

    return phase === 'shown' || phase === 'reading';
  });

  protected readonly nextDisabled = computed(() =>
    this.state() === 'closed'
      ? !this.canOpenNow()
      : !this.canGoNext() || this.isAnimating(),
  );

  readonly pageChange = output<MagazinePageChangeEvent>();
  /** La tapa terminó de abrirse: la revista está abierta. */
  readonly opened = output<void>();
  /** La tapa terminó de cerrarse: la revista está cerrada. */
  readonly closed = output<void>();

  constructor() {
    this.destroyRef.onDestroy(() => this.clearFallbackTimer());
  }

  readonly totalSpreads = (): number => {
    const count = this.pages().length;
    return count === 0 ? 0 : Math.ceil((count + 1) / 2);
  };

  readonly leftPage = (): number | null => {
    const spread = this.currentSpread();

    if (spread === 0) {
      return null;
    }

    const index = spread * 2 - 1;

    return index < this.pages().length ? index : null;
  };

  readonly rightPage = (): number | null => {
    const spread = this.currentSpread();
    const index = spread === 0 ? 0 : spread * 2;

    return index < this.pages().length ? index : null;
  };

  readonly canGoPrevious = (): boolean => this.currentSpread() > 0;

  readonly canGoNext = (): boolean =>
    this.currentSpread() < this.totalSpreads() - 1;

  /**
   * Única fuente de verdad del renderizado. Cada índice aparece como
   * máximo en una ranura, de modo que una página nunca se pinta dos veces.
   */
  readonly composition = computed<MagazineComposition>(() => {
    const count = this.pages().length;
    const valid = (index: number | null): number | null =>
      index !== null && index >= 0 && index < count ? index : null;

    if (count === 0) {
      return { left: null, right: null, front: null, back: null };
    }

    const state = this.flip();

    if (!state) {
      if (this.state() === 'closed') {
        // Revista cerrada: solo la portada (el libro va desplazado).
        return { left: null, right: 0, front: null, back: null };
      }

      return {
        left: this.leftPage(),
        right: this.rightPage(),
        front: null,
        back: null,
      };
    }

    const front = valid(state.frontPage);
    const back = valid(state.backPage);

    if (state.direction === 'next') {
      // Izquierda: sigue la actual. Derecha: la del pliego de destino,
      // que queda al descubierto bajo la hoja.
      return {
        left: valid(this.leftPage()),
        right: valid(state.targetSpread * 2),
        front,
        back,
      };
    }

    // Retroceso. Derecha: la actual, que la hoja va a cubrir.
    // Izquierda: la del pliego de destino (ninguna si es la portada).
    return {
      left: state.targetSpread > 0 ? valid(state.targetSpread * 2 - 1) : null,
      right: valid(this.rightPage()),
      front,
      back,
    };
  });

  /** `true` si la página está en la capa estática (no en la hoja que gira). */
  isPageVisible(index: number): boolean {
    const c = this.composition();
    return index === c.left || index === c.right;
  }

  pageTemplate(index: number | null): TemplateRef<unknown> | null {
    if (index === null) {
      return null;
    }

    return this.pages()[index]?.template ?? null;
  }

  /**
   * Abre la revista: la portada gira como una tapa (pliego 0 → 1) mientras
   * el libro se centra. Hacen falta al menos dos páginas.
   */
  open(): void {
    if (this.pages().length < 2 || this.state() !== 'closed') {
      return;
    }

    this.currentSpread.set(0);
    this.isOpen.set(true);
    this.state.set('opening');

    this.startFlip({
      direction: 'next',
      frontPage: 0,
      backPage: 1,
      targetSpread: 1,
      progress: false,
    });
  }

  /**
   * Cierra la revista siempre desde la portada: si estaba en otro pliego,
   * salta al pliego 1 y la tapa gira hacia atrás mientras el libro se
   * descentra. Se ignora si hay un giro en curso.
   */
  close(): void {
    if (this.state() !== 'open' || this.isAnimating()) {
      return;
    }

    this.currentSpread.set(1);
    this.isOpen.set(false);
    this.state.set('closing');

    this.startFlip({
      direction: 'previous',
      frontPage: 1,
      backPage: 0,
      targetSpread: 0,
      progress: false,
    });
  }

  /** Cierra la revista al instante, sin animación, y vuelve a la portada. */
  reset(): void {
    this.clearFallbackTimer();
    this.flipToken++;

    this.flip.set(null);
    this.flipping.set(false);
    this.currentSpread.set(0);
    this.isOpen.set(false);
    this.state.set('closed');
  }

  nextSpread(): void {
    if (!this.isOpen() || this.isAnimating() || !this.canGoNext()) {
      return;
    }

    const targetSpread = this.currentSpread() + 1;
    const frontPage = this.rightPage();
    const backPage = targetSpread * 2 - 1;

    if (frontPage === null || backPage < 0 || backPage >= this.pages().length) {
      this.currentSpread.set(targetSpread);
      this.emitPageChange();
      return;
    }

    this.startFlip({
      direction: 'next',
      frontPage,
      backPage,
      targetSpread,
      progress: false,
    });
  }

  /** Pliego anterior. Desde el pliego 1, vuelve a la portada cerrando el libro. */
  previousSpread(): void {
    if (!this.isOpen() || this.isAnimating() || !this.canGoPrevious()) {
      return;
    }

    if (this.currentSpread() === 1) {
      this.close();
      return;
    }

    const targetSpread = this.currentSpread() - 1;
    const frontPage = this.leftPage();
    const backPage = targetSpread * 2;

    if (frontPage === null || backPage < 0 || backPage >= this.pages().length) {
      this.currentSpread.set(targetSpread);
      this.emitPageChange();
      return;
    }

    this.startFlip({
      direction: 'previous',
      frontPage,
      backPage,
      targetSpread,
      progress: false,
    });
  }

  finishFlip(event: TransitionEvent): void {
    if (
      event.target !== event.currentTarget ||
      event.propertyName !== 'transform'
    ) {
      return;
    }

    this.completeFlip();
  }

  /** Botón ›: abre la revista si está cerrada; si no, pasa de pliego. */
  protected onNext(): void {
    if (this.state() === 'closed') {
      if (this.canOpenNow()) {
        this.open();
      }
    } else {
      this.nextSpread();
    }
  }

  /** Clic en la portada cerrada de una colección: abre la revista. */
  protected onCoverClick(): void {
    if (this.embedded && this.canOpenNow()) {
      this.open();
    }
  }

  private startFlip(state: FlipState): void {
    const token = ++this.flipToken;

    this.flipping.set(true);
    this.flip.set(state);

    // La hoja debe existir y tener su estilo inicial calculado ANTES de
    // activar `is-flipping`; si no, el navegador no anima la transición.
    afterNextRender(
      () => {
        if (token !== this.flipToken || !this.flip()) {
          return;
        }

        this.sheet()?.nativeElement.getBoundingClientRect();

        this.flip.update((current) =>
          current ? { ...current, progress: true } : current,
        );
      },
      { injector: this.injector },
    );

    // Salvaguarda: si `transitionend` no llega (pestaña oculta, display:none),
    // el giro se completa igualmente y los controles no quedan bloqueados.
    this.clearFallbackTimer();
    this.fallbackTimer = setTimeout(
      () => this.completeFlip(token),
      FLIP_FALLBACK_MS,
    );
  }

  private completeFlip(token?: number): void {
    const state = this.flip();

    if (!state || (token !== undefined && token !== this.flipToken)) {
      return;
    }

    this.clearFallbackTimer();
    this.flipToken++;

    this.currentSpread.set(state.targetSpread);
    this.flip.set(null);
    this.flipping.set(false);
    this.emitPageChange();

    if (this.state() === 'opening') {
      this.state.set('open');
      this.opened.emit();
    } else if (this.state() === 'closing') {
      this.state.set('closed');
      this.closed.emit();
    }
  }

  private clearFallbackTimer(): void {
    if (this.fallbackTimer !== null) {
      clearTimeout(this.fallbackTimer);
      this.fallbackTimer = null;
    }
  }

  private emitPageChange(): void {
    this.pageChange.emit({
      currentSpread: this.currentSpread(),
      totalSpreads: this.totalSpreads(),
      leftPage: this.leftPage(),
      rightPage: this.rightPage(),
    });
  }
}