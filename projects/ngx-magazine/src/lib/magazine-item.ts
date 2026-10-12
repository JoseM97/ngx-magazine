import { DOCUMENT, NgTemplateOutlet } from '@angular/common';
import {
  Component,
  DestroyRef,
  ElementRef,
  TemplateRef,
  computed,
  contentChild,
  effect,
  inject,
  input,
  signal,
  untracked,
  viewChild,
} from '@angular/core';
import { fitBurstFontSize } from './burst-fit';
import { MAGAZINE_COLLECTION, MagazinePhase } from './collection-token';
import { MagazineState, NgxMagazine } from './ngx-magazine';

/** Duración de la transición de la modal (debe coincidir con los estilos). */
const MODAL_TRANSITION_MS = 380;
/** Si `transitionend` no llega, la fase avanza igualmente. */
const MODAL_FALLBACK_MS = MODAL_TRANSITION_MS + 400;

/** Elementos en los que las flechas tienen su propio significado. */
const KEY_IGNORED_TARGETS =
  'input, textarea, select, video, audio, [contenteditable=""], [contenteditable="true"]';

/**
 * Una revista dentro de una colección. Su portada es la página 0 del
 * `<ngx-magazine>` que contiene: el consumidor no la define dos veces.
 *
 * Se dibuja como una caja 3D (portada, trasera, lomo, canto y tapas). Por
 * defecto usa proyección ortográfica (sin perspectiva): así los bordes
 * quedan perfectamente horizontales o verticales y no se ven escalonados.
 *
 * Al seleccionarla, el `<ngx-magazine>` real se proyecta dentro de una
 * modal (`<dialog>`) sobre un fondo oscurecido: aparece cerrado y centrado,
 * y el usuario lo abre con › (o la flecha →) o con un clic en la portada.
 * La modal tiene un aspecto sencillo (sin contorno ni esquinas redondeadas);
 * el estilo de cómic es solo el de la mesa.
 *
 * Teclado dentro de la modal: → abre o pasa de pliego, ← retrocede (desde el
 * pliego 1 cierra el libro) y Escape cierra la modal.
 *
 * Variables CSS opcionales:
 * - `--ngx-magazine-thickness`: grosor de la revista (por defecto 12px).
 * - `--ngx-magazine-perspective`: perspectiva de cada revista (por defecto
 *   `none`). Un valor como `1600px` añade convergencia, pero los bordes
 *   inclinados pueden verse serrados.
 * - `--ngx-magazine-ink`: color del contorno y la sombra de cómic (mesa).
 * - `--ngx-magazine-pop`: color del globo de cómic (mesa).
 * - `--ngx-magazine-burst-size`: ancho del globo respecto a la revista
 *   (por defecto 70%).
 * - `--ngx-magazine-paper`: color de fondo de la portada y las páginas.
 * - `--ngx-magazine-modal-shadow`: sombra ambiental del libro en la modal
 *   (por defecto `0 18px 50px rgb(0 0 0 / 45%)`; `none` para quitarla).
 * - `--ngx-magazine-focus-ring`: anillo de foco adicional con el teclado
 *   (valor de `outline`, p. ej. `3px solid #fff`). Por defecto `none`: el
 *   indicador de foco es el propio estilo de cómic de la revista.
 */
@Component({
  selector: 'ngx-magazine-item',
  standalone: true,
  imports: [NgTemplateOutlet],
  host: {
    '[class.is-selected]': 'isSelected()',
  },
  template: `
    <div
      #cover
      class="item__cover"
      role="button"
      tabindex="0"
      [attr.aria-label]="label() || null"
      [attr.aria-pressed]="isSelected()"
      (click)="activate()"
      (keydown.enter)="activate()"
      (keydown.space)="onSpace($event)"
    >
      <div class="item__scene">
        <div class="item__shadow"></div>

        <div class="book">
          <div class="book__face book__back" [style.background-color]="spineColor()"></div>
          <div class="book__face book__spine" [style.background-color]="spineColor()"></div>
          <div class="book__face book__edge"></div>
          <div class="book__face book__top"></div>
          <div class="book__face book__bottom"></div>

          <div class="book__face book__front">
            <div class="item__cover-content">
              <ng-container [ngTemplateOutlet]="coverTemplate()" />
            </div>
          </div>
        </div>
      </div>

      @if (burstLabel()) {
        <div class="item__burst" aria-hidden="true" [style.--burst-fs]="burstFontSize()">
          <div class="item__burst-shape">
            <span class="item__burst-text">{{ burstLabel() }}</span>
          </div>
        </div>
      }
    </div>

    @if (isSelected()) {
      <dialog
        #dialog
        class="modal"
        [attr.aria-label]="label() || null"
        (cancel)="onCancel($event)"
        (close)="onNativeClose()"
        (click)="onDialogClick($event)"
        (keydown)="onKeydown($event)"
      >
        <div class="modal__scrim" [class.is-visible]="visible()"></div>

        <div class="modal__stage">
          <div
            class="modal__book"
            [class.is-visible]="visible()"
            (transitionend)="onBookTransitionEnd($event)"
          >
            <ng-content />
          </div>

          <button
            type="button"
            class="modal__close"
            [class.is-visible]="visible()"
            aria-label="Close"
            (click)="requestClose()"
          >
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
          </button>
        </div>
      </dialog>
    }
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
      max-width: 170px;
      margin-inline: auto;
      --book-thickness: var(--ngx-magazine-thickness, 12px);
      --ink: var(--ngx-magazine-ink, #111);
      --pop: var(--ngx-magazine-pop, #ffd400);
      --burst-size: var(--ngx-magazine-burst-size, 70%);
    }

    .item__cover {
      position: relative;
      width: 100%;
      aspect-ratio: 3 / 4;
      cursor: pointer;
    }

    /*
     * Escena 3D de la revista. Sin perspectiva (por defecto), los bordes de
     * las caras giradas solo se acortan: siguen alineados con los píxeles y
     * no se escalonan. El contorno de cómic se aplica aquí y NO en
     * .item__cover, para que no afecte al globo.
     */
    .item__scene {
      position: absolute;
      inset: 0;
      perspective: var(--ngx-magazine-perspective, none);
    }

    /* Sombra suave de reposo sobre la mesa. */
    .item__shadow {
      position: absolute;
      left: 10%;
      bottom: -3%;
      width: 88%;
      height: 9%;
      border-radius: 50%;
      background: radial-gradient(
        ellipse at center,
        rgb(0 0 0 / 50%),
        rgb(0 0 0 / 0%) 70%
      );
      filter: blur(4px);
    }

    .book {
      position: absolute;
      inset: 0;
      transform-style: preserve-3d;
      transform: rotateY(var(--ngx-magazine-tilt, 24deg));
      transition: transform 180ms ease-out;
    }

    .book__face {
      position: absolute;
      box-sizing: border-box;
      backface-visibility: hidden;
      -webkit-backface-visibility: hidden;
    }

    /* Portada: la cara que ve el usuario. */
    .book__front {
      inset: 0;
      overflow: hidden;
      border-radius: 1px 3px 3px 1px;
      background: var(--ngx-magazine-paper, white);
      transform: translateZ(calc(var(--book-thickness) / 2));
    }

    /* Trama de puntos de cómic (Ben-Day): solo visible en hover. */
    .book__front::before {
      content: '';
      position: absolute;
      inset: 0;
      z-index: 1;
      pointer-events: none;
      opacity: 0;
      background-image: radial-gradient(
        circle,
        rgb(0 0 0 / 60%) 1.1px,
        transparent 1.5px
      );
      background-size: 6px 6px;
      mix-blend-mode: multiply;
      -webkit-mask-image: linear-gradient(to top right, #000, transparent 70%);
      mask-image: linear-gradient(to top right, #000, transparent 70%);
      transition: opacity 120ms ease-out;
    }

    /* Surco del lomo sobre la portada. */
    .book__front::after {
      content: '';
      position: absolute;
      inset: 0 auto 0 0;
      z-index: 2;
      width: 5%;
      pointer-events: none;
      background: linear-gradient(
        90deg,
        rgb(0 0 0 / 22%),
        rgb(255 255 255 / 10%) 60%,
        transparent
      );
    }

    /*
     * Contenedor de la portada: ocupa toda la cara y no impone nada a su
     * contenido (texto, imágenes, vídeo...), que se coloca con normalidad.
     */
    .item__cover-content {
      width: 100%;
      height: 100%;
      pointer-events: none;
    }

    .book__back {
      inset: 0;
      transform: translateZ(calc(var(--book-thickness) / -2)) rotateY(180deg);
    }

    /* Lomo: centrado en el borde izquierdo y girado 90°. */
    .book__spine {
      top: 0;
      left: calc(var(--book-thickness) / -2);
      width: var(--book-thickness);
      height: 100%;
      transform: rotateY(-90deg);
      background-image: linear-gradient(
        90deg,
        rgb(0 0 0 / 25%),
        rgb(255 255 255 / 10%) 50%,
        rgb(0 0 0 / 20%)
      );
    }

    /* Canto de las páginas, tapa y base: papel. */
    .book__edge,
    .book__top,
    .book__bottom {
      background-color: #f1ece2;
      background-image: repeating-linear-gradient(
        90deg,
        rgb(0 0 0 / 0%) 0 2px,
        rgb(0 0 0 / 7%) 2px 3px
      );
    }

    .book__edge {
      top: 0;
      left: calc(100% - var(--book-thickness) / 2);
      width: var(--book-thickness);
      height: 100%;
      transform: rotateY(90deg);
    }

    .book__top {
      top: calc(var(--book-thickness) / -2);
      left: 0;
      width: 100%;
      height: var(--book-thickness);
      transform: rotateX(90deg);
      background-image: repeating-linear-gradient(
        0deg,
        rgb(0 0 0 / 0%) 0 2px,
        rgb(0 0 0 / 7%) 2px 3px
      );
    }

    .book__bottom {
      top: calc(100% - var(--book-thickness) / 2);
      left: 0;
      width: 100%;
      height: var(--book-thickness);
      transform: rotateX(-90deg);
      background-image: repeating-linear-gradient(
        0deg,
        rgb(0 0 0 / 0%) 0 2px,
        rgb(0 0 0 / 7%) 2px 3px
      );
    }

    /*
     * Globo de cómic. Es hermano de .item__scene, fuera de su filtro, así
     * que no recibe el contorno de la revista. El contenedor lleva la
     * animación y la sombra dura; .item__burst-shape lleva el clip-path.
     * (clip-path recortaría una sombra aplicada en el mismo elemento.)
     *
     * container-type permite medir el texto en cqw (porcentaje del ancho
     * del globo); --burst-fs lo calcula Angular según la longitud del texto.
     * Como el texto se mide respecto al globo, crece con él.
     */
    .item__burst {
      position: absolute;
      z-index: 3;
      top: -24%;
      right: -26%;
      width: var(--burst-size);
      aspect-ratio: 1;
      container-type: inline-size;
      pointer-events: none;
      opacity: 0;
      filter: drop-shadow(5px 5px 0 var(--ink));
      transform: scale(0.35) rotate(-20deg);
      transition:
        transform 200ms cubic-bezier(0.3, 1.8, 0.5, 1),
        opacity 100ms ease-out;
    }

    /*
     * Estrella regular de 12 puntas: radio exterior 50, interior 37,
     * centrada en (50, 50). Capa negra (borde) bajo la capa amarilla.
     */
    .item__burst-shape,
    .item__burst-shape::before {
      clip-path: polygon(
        50% 0%, 59.58% 14.26%, 75% 6.7%, 76.16% 23.84%, 93.3% 25%,
        85.74% 40.42%, 100% 50%, 85.74% 59.58%, 93.3% 75%, 76.16% 76.16%,
        75% 93.3%, 59.58% 85.74%, 50% 100%, 40.42% 85.74%, 25% 93.3%,
        23.84% 76.16%, 6.7% 75%, 14.26% 59.58%, 0% 50%, 14.26% 40.42%,
        6.7% 25%, 23.84% 23.84%, 25% 6.7%, 40.42% 14.26%
      );
    }

    .item__burst-shape {
      position: relative;
      width: 100%;
      height: 100%;
      display: grid;
      place-items: center;
      background: var(--ink);
    }

    .item__burst-shape::before {
      content: '';
      position: absolute;
      inset: 8%;
      background: var(--pop);
    }

    /* Respaldo (0.95rem) para navegadores sin unidades de contenedor. */
    .item__burst-text {
      position: relative;
      max-width: 52%;
      color: var(--ink);
      font-family: Impact, 'Arial Narrow Bold', 'Arial Black', sans-serif;
      font-size: 0.95rem;
      font-size: calc(var(--burst-fs, 10) * 1cqw);
      line-height: 1.05;
      letter-spacing: 0.02em;
      text-align: center;
      text-transform: uppercase;
      overflow-wrap: anywhere;
    }

    /*
     * Estilo de cómic al enfocar con teclado o al estar seleccionada.
     * El mismo estilo con el ratón va más abajo, solo en dispositivos con
     * hover real: en táctil, :hover se queda pegado tras tocar.
     */
    .item__cover:focus-visible .item__scene,
    :host(.is-selected) .item__scene {
      filter: drop-shadow(2px 0 0 var(--ink)) drop-shadow(-2px 0 0 var(--ink))
        drop-shadow(0 2px 0 var(--ink)) drop-shadow(0 -2px 0 var(--ink))
        drop-shadow(6px 6px 0 var(--ink));
    }

    .item__cover:focus-visible .book,
    :host(.is-selected) .book {
      transform: translate3d(0, -6px, 16px)
        rotateY(var(--ngx-magazine-tilt, 24deg));
    }

    .item__cover:focus-visible .item__shadow,
    :host(.is-selected) .item__shadow {
      opacity: 0;
    }

    .item__cover:focus-visible .book__front::before,
    :host(.is-selected) .book__front::before {
      opacity: 0.45;
    }

    .item__cover:focus-visible .item__burst,
    :host(.is-selected) .item__burst {
      opacity: 1;
      transform: scale(1) rotate(12deg);
    }

    @media (hover: hover) {
      .item__cover:hover .item__scene {
        filter: drop-shadow(2px 0 0 var(--ink)) drop-shadow(-2px 0 0 var(--ink))
          drop-shadow(0 2px 0 var(--ink)) drop-shadow(0 -2px 0 var(--ink))
          drop-shadow(6px 6px 0 var(--ink));
      }

      .item__cover:hover .book {
        transform: translate3d(0, -6px, 16px)
          rotateY(var(--ngx-magazine-tilt, 24deg));
      }

      .item__cover:hover .item__shadow {
        opacity: 0;
      }

      .item__cover:hover .book__front::before {
        opacity: 0.45;
      }

      .item__cover:hover .item__burst {
        opacity: 1;
        transform: scale(1) rotate(12deg);
      }
    }

    /*
     * Foco con teclado: el indicador es el propio estilo de cómic de arriba
     * (contorno, sombra dura, trama, elevación y globo). Un anillo extra es
     * opcional, mediante --ngx-magazine-focus-ring.
     */
    .item__cover:focus-visible {
      outline: var(--ngx-magazine-focus-ring, none);
      outline-offset: 6px;
    }

    /* ------------------------------------------------------------------
     * Modal (<dialog> nativo): velo oscuro + revista real centrada.
     * Se pinta en la capa superior del navegador: ningún overflow ni
     * transform de la mesa la recorta. Aspecto sencillo: sin contorno
     * negro, sin sombra dura y con esquinas rectas.
     * ------------------------------------------------------------------ */
    .modal {
      position: fixed;
      inset: 0;
      width: 100%;
      height: 100%;
      max-width: none;
      max-height: none;
      margin: 0;
      padding: 0;
      border: 0;
      background: transparent;
      color: inherit;
      overflow: hidden;
      overscroll-behavior: contain;
    }

    .modal::backdrop {
      background: transparent;
    }

    .modal__scrim {
      position: absolute;
      inset: 0;
      background: rgb(0 0 0 / 72%);
      opacity: 0;
      transition: opacity 320ms ease-out;
    }

    .modal__scrim.is-visible {
      opacity: 1;
    }

    .modal__stage {
      position: absolute;
      inset: 0;
      display: grid;
      place-items: center;
    }

    /*
     * Pliego 3:2 que cabe siempre en el viewport. El alto disponible
     * descuenta 96px: los 56px de la píldora de controles (que va bajo el
     * libro) y un margen. La revista cerrada se dibuja centrada (una página
     * 3:4) y, al abrirse, el libro ocupa el pliego completo. Sin sombra por
     * página ni contorno; la elevación es un halo ambiental difuso
     * (--ngx-magazine-modal-shadow).
     */
    .modal__book {
      position: relative;
      width: min(92vw, calc((100vh - 96px) * 3 / 2));
      width: min(92vw, calc((100dvh - 96px) * 3 / 2));
      opacity: 0;
      transform: translateY(28px) scale(0.86);
      transition:
        transform 380ms cubic-bezier(0.2, 0.8, 0.2, 1),
        opacity 300ms ease-out;
      --ngx-magazine-max-width: none;
      --ngx-magazine-background: transparent;
      --ngx-magazine-overflow: visible;
      --ngx-magazine-radius: 0px;
      --ngx-magazine-page-shadow: var(
        --ngx-magazine-modal-shadow,
        0 18px 50px rgb(0 0 0 / 45%)
      );
      --ngx-magazine-face-shadow: none;
    }

    .modal__book.is-visible {
      opacity: 1;
      transform: none;
    }

    /* Pantallas estrechas: el libro aprovecha casi todo el ancho. */
    @media (max-width: 600px) {
      .modal__book {
        width: min(96vw, calc((100vh - 96px) * 3 / 2));
        width: min(96vw, calc((100dvh - 96px) * 3 / 2));
      }
    }

    /* Botón de cierre: círculo de cristal oscuro con una × de trazo fino. */
    .modal__close {
      position: absolute;
      top: max(16px, env(safe-area-inset-top));
      right: max(16px, env(safe-area-inset-right));
      display: grid;
      place-items: center;
      width: 40px;
      height: 40px;
      padding: 0;
      border: 0;
      border-radius: 50%;
      background: rgb(18 18 18 / 62%);
      -webkit-backdrop-filter: blur(10px);
      backdrop-filter: blur(10px);
      color: #fff;
      cursor: pointer;
      opacity: 0;
      transition:
        opacity 300ms ease-out,
        background 150ms ease-out;
    }

    @media (pointer: coarse) {
      .modal__close {
        width: 44px;
        height: 44px;
      }
    }

    .modal__close svg {
      width: 18px;
      height: 18px;
      fill: none;
      stroke: currentColor;
      stroke-width: 2;
      stroke-linecap: round;
    }

    .modal__close.is-visible {
      opacity: 1;
    }

    .modal__close:hover {
      background: rgb(255 255 255 / 22%);
    }

    .modal__close:focus-visible {
      outline: 2px solid #fff;
      outline-offset: 2px;
    }

    @media (prefers-reduced-motion: reduce) {
      .book,
      .item__burst,
      .book__front::before {
        transition: none;
      }

      .modal__scrim,
      .modal__book,
      .modal__close {
        transition-duration: 1ms;
      }
    }
  `,
})
export class NgxMagazineItem {
  private readonly collection = inject(MAGAZINE_COLLECTION, { optional: true });
  private readonly doc = inject(DOCUMENT);
  private readonly destroyRef = inject(DestroyRef);

  /** Identificador único dentro de la colección. */
  readonly id = input.required<string>();
  /** Nombre accesible de la revista (también es el texto por defecto del globo). */
  readonly label = input('');
  /** Color del lomo y de la trasera (cualquier color CSS). */
  readonly spineColor = input('#3b3b3b');
  /**
   * Texto del globo de cómic que aparece al pasar el ratón.
   * Si no se indica, se usa `label`. Con una cadena vacía, no hay globo.
   */
  readonly burstText = input<string | null>(null);

  private readonly magazine = contentChild(NgxMagazine);
  private readonly coverRef = viewChild<ElementRef<HTMLElement>>('cover');
  private readonly dialogRef = viewChild<ElementRef<HTMLDialogElement>>('dialog');

  /** Controla la clase `is-visible` de la modal (dispara las transiciones). */
  protected readonly visible = signal(false);

  private armedFor: MagazinePhase | null = null;
  private opened = false;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private previousOverflow: string | null = null;

  protected readonly coverTemplate = computed<TemplateRef<unknown> | null>(
    () => this.magazine()?.pages()[0]?.template ?? null,
  );

  protected readonly burstLabel = computed(() =>
    (this.burstText() ?? this.label()).trim(),
  );

  /** Tamaño de letra (en cqw) con el que el texto cabe en la estrella. */
  protected readonly burstFontSize = computed(() =>
    fitBurstFontSize(this.burstLabel()),
  );

  readonly isSelected = computed(
    () => this.collection?.selectedId() === this.id(),
  );

  constructor() {
    effect(() => {
      const dialog = this.dialogRef()?.nativeElement;
      const selected = this.isSelected();
      const phase = this.collection?.phase() ?? 'idle';
      const magazine = this.magazine();
      const magazineState = magazine?.state() ?? 'closed';
      const busy = magazine?.isAnimating() ?? false;

      untracked(() =>
        this.sync(dialog, selected, phase, magazine, magazineState, busy),
      );
    });

    this.destroyRef.onDestroy(() => this.resetState());
  }

  protected activate(): void {
    this.collection?.select(this.id());
  }

  protected onSpace(event: Event): void {
    event.preventDefault();
    this.activate();
  }

  protected requestClose(): void {
    this.collection?.close();
  }

  /** Escape: se intercepta para animar el cierre en lugar de cerrar de golpe. */
  protected onCancel(event: Event): void {
    event.preventDefault();
    this.requestClose();
  }

  /**
   * Flechas dentro de la modal: → abre la revista o pasa de pliego, ←
   * retrocede (desde el pliego 1 cierra el libro). Se respetan las mismas
   * reglas que los botones: nada ocurre durante un giro ni mientras la modal
   * aparece. Se ignoran con modificadores y sobre controles que usan las
   * flechas (campos de texto, vídeo, audio...).
   */
  protected onKeydown(event: KeyboardEvent): void {
    if (event.defaultPrevented) {
      return;
    }

    if (event.key !== 'ArrowRight' && event.key !== 'ArrowLeft') {
      return;
    }

    if (event.ctrlKey || event.altKey || event.metaKey || event.shiftKey) {
      return;
    }

    const target = event.target as Element | null;

    if (target?.closest?.(KEY_IGNORED_TARGETS)) {
      return;
    }

    const phase = this.collection?.phase();
    const magazine = this.magazine();

    if (!magazine || (phase !== 'shown' && phase !== 'reading')) {
      return;
    }

    event.preventDefault();

    if (event.key === 'ArrowRight') {
      if (magazine.state() === 'closed') {
        magazine.open();
      } else {
        magazine.nextSpread();
      }
    } else {
      magazine.previousSpread();
    }
  }

  /** Clic fuera de la revista y del botón: cierra. */
  protected onDialogClick(event: MouseEvent): void {
    const target = event.target as Element | null;

    if (target && !target.closest('.modal__book, .modal__close')) {
      this.requestClose();
    }
  }

  /**
   * El navegador cerró el diálogo por su cuenta (p. ej. segunda pulsación
   * de Escape en Chrome, donde `cancel` ya no es cancelable). Se cierra
   * sin animación para no dejar la colección bloqueada.
   */
  protected onNativeClose(): void {
    if (this.isSelected() && this.collection && this.collection.phase() !== 'idle') {
      this.magazine()?.reset();
      this.resetState();
      this.collection.finishLeave();
    }
  }

  protected onBookTransitionEnd(event: TransitionEvent): void {
    if (event.target !== event.currentTarget || event.propertyName !== 'transform') {
      return;
    }

    const phase = this.collection?.phase();

    if (phase === 'entering') {
      this.collection?.finishEnter();
    } else if (phase === 'leaving') {
      this.completeLeave();
    }
  }

  private sync(
    dialog: HTMLDialogElement | undefined,
    selected: boolean,
    phase: MagazinePhase,
    magazine: NgxMagazine | undefined,
    magazineState: MagazineState,
    busy: boolean,
  ): void {
    if (!selected) {
      this.resetState();
      return;
    }

    // Una vez por cambio de fase: temporizador de seguridad.
    if (this.armedFor !== phase) {
      this.armedFor = phase;
      this.clearTimer();

      if (phase === 'entering') {
        this.timer = setTimeout(() => {
          if (this.collection?.phase() === 'entering') {
            this.collection.finishEnter();
          }
        }, MODAL_FALLBACK_MS);
      } else if (phase === 'leaving') {
        this.visible.set(false);
        this.timer = setTimeout(() => this.completeLeave(), MODAL_FALLBACK_MS);
      }
    }

    // Abrir el diálogo cuando ya existe en el DOM.
    if (phase === 'entering' && dialog && !this.opened) {
      this.opened = true;
      this.lockScroll();

      if (!dialog.open) {
        if (typeof dialog.showModal === 'function') {
          dialog.showModal();
        } else {
          dialog.setAttribute('open', '');
        }
      }

      // Fuerza el cálculo del estilo inicial ANTES de activar la clase;
      // si no, el navegador no anima la transición.
      void dialog.offsetWidth;
      this.visible.set(true);
    }

    if (!this.collection) {
      return;
    }

    if (phase === 'shown' && magazineState === 'opening') {
      // El usuario ha abierto la revista (›, flecha →, o clic en la portada).
      this.collection.startOpen();
    } else if (phase === 'shown' && magazineState === 'open') {
      // La apertura terminó antes de que se reflejara la fase.
      this.collection.startOpen();
      this.collection.finishOpen();
    } else if (phase === 'opening' && magazineState === 'open') {
      this.collection.finishOpen();
    } else if (phase === 'closing') {
      if (!magazine || magazineState === 'closed') {
        this.collection.finishClosing();
      } else if (magazineState === 'open' && !busy) {
        // Si hay un giro en curso, se espera: este efecto se repite
        // cuando `busy` pasa a false.
        magazine.close();
      }
    }
  }

  private completeLeave(): void {
    if (this.collection?.phase() !== 'leaving') {
      return;
    }

    const dialog = this.dialogRef()?.nativeElement;

    if (dialog) {
      if (typeof dialog.close === 'function') {
        dialog.close();
      } else {
        dialog.removeAttribute('open');
      }
    }

    this.resetState();
    this.collection.finishLeave();
    this.coverRef()?.nativeElement.focus({ preventScroll: true });
  }

  private resetState(): void {
    this.clearTimer();
    this.armedFor = null;
    this.opened = false;
    this.visible.set(false);
    this.unlockScroll();
  }

  private clearTimer(): void {
    if (this.timer !== null) {
      clearTimeout(this.timer);
      this.timer = null;
    }
  }

  private lockScroll(): void {
    if (this.previousOverflow === null) {
      const root = this.doc.documentElement;
      this.previousOverflow = root.style.overflow;
      root.style.overflow = 'hidden';
    }
  }

  private unlockScroll(): void {
    if (this.previousOverflow !== null) {
      this.doc.documentElement.style.overflow = this.previousOverflow;
      this.previousOverflow = null;
    }
  }
}