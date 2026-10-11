import {
  Component,
  contentChildren,
  forwardRef,
  input,
  output,
  signal,
} from '@angular/core';
import { MAGAZINE_COLLECTION, MagazinePhase } from './collection-token';
import { NgxMagazineItem } from './magazine-item';

export interface MagazineCollectionEvent {
  id: string;
  label: string;
}

@Component({
  selector: 'ngx-magazine-collection',
  standalone: true,
  providers: [
    {
      provide: MAGAZINE_COLLECTION,
      useExisting: forwardRef(() => NgxMagazineCollection),
    },
  ],
  template: `
    <div class="collection" role="group" [attr.aria-label]="label()">
      <div class="table">
        <div
          class="grid"
          [style.--ngx-magazine-cols]="columns()"
          [style.--ngx-magazine-tilt]="tilt() + 'deg'"
          [style.--ngx-magazine-gap]="gap()"
          [style.--ngx-magazine-row-gap]="rowGap()"
        >
          <ng-content />
        </div>
      </div>
    </div>
  `,
  styles: `
    :host {
      display: block;
      width: 100%;
    }

    /* Contenedor de consulta: solo contiene, no participa en el 3D. */
    .collection {
      container-type: inline-size;
      width: 100%;
    }

    /* Superficie de la mesa. La perspectiva es de cada revista, no de la mesa. */
    .table {
      padding: 4rem 3rem 5rem;
    }

    /*
     * Rejilla plana: todas las revistas ocupan celdas del mismo tamaño.
     * Primer valor de gap = entre filas; segundo = entre columnas.
     */
    .grid {
      display: grid;
      grid-template-columns: repeat(
        var(--ngx-magazine-cols, var(--auto-cols, 2)),
        minmax(0, 1fr)
      );
      gap: var(--ngx-magazine-row-gap, 4.5rem) var(--ngx-magazine-gap, 3rem);
      align-items: start;
    }

    @container (min-width: 720px) {
      .grid {
        --auto-cols: 3;
      }
    }
  `,
})
export class NgxMagazineCollection {
  /** Número de columnas. Si es `null`, se adapta al ancho del contenedor. */
  readonly columns = input<number | null>(null);
  /** Giro de cada revista sobre su eje vertical, en grados. */
  readonly tilt = input(24);
  /** Separación horizontal entre revistas (cualquier longitud CSS). */
  readonly gap = input('3rem');
  /** Separación vertical entre filas (cualquier longitud CSS). */
  readonly rowGap = input('4.5rem');
  /** Nombre accesible de la colección. */
  readonly label = input('Magazine collection');

  /** Se emite al seleccionar una revista (empieza la animación de entrada). */
  readonly magazineSelect = output<MagazineCollectionEvent>();
  /** Se emite cuando la revista termina de abrirse y empieza la lectura. */
  readonly magazineOpen = output<MagazineCollectionEvent>();
  /** Se emite cuando la revista ya ha terminado de cerrarse y volver a la mesa. */
  readonly magazineClose = output<MagazineCollectionEvent>();

  private readonly items = contentChildren(NgxMagazineItem);

  private readonly _selectedId = signal<string | null>(null);
  readonly selectedId = this._selectedId.asReadonly();

  private readonly _phase = signal<MagazinePhase>('idle');
  readonly phase = this._phase.asReadonly();

  /** Cierre pedido mientras la revista aún se estaba abriendo. */
  private pendingClose = false;

  /** Selecciona una revista. Se ignora si ya hay una interacción en curso. */
  select(id: string): void {
    if (this._phase() !== 'idle') {
      return;
    }

    const item = this.items().find((candidate) => candidate.id() === id);

    if (!item) {
      return;
    }

    this._selectedId.set(id);
    this._phase.set('entering');
    this.magazineSelect.emit({ id, label: item.label() });
  }

  /**
   * Inicia el cierre animado de la revista seleccionada. Si todavía se está
   * abriendo, el cierre se aplaza hasta que termine de abrirse.
   */
  close(): void {
    switch (this._phase()) {
      case 'entering':
      case 'shown':
        this._phase.set('leaving');
        break;
      case 'opening':
        this.pendingClose = true;
        break;
      case 'reading':
        this._phase.set('closing');
        break;
      default:
        break;
    }
  }

  finishEnter(): void {
    if (this._phase() === 'entering') {
      this._phase.set('shown');
    }
  }

  startOpen(): void {
    if (this._phase() === 'shown') {
      this._phase.set('opening');
    }
  }

  finishOpen(): void {
    if (this._phase() !== 'opening') {
      return;
    }

    if (this.pendingClose) {
      this.pendingClose = false;
      this._phase.set('closing');
    } else {
      this._phase.set('reading');
    }

    this.emitFor(this.magazineOpen);
  }

  finishClosing(): void {
    if (this._phase() === 'closing') {
      this._phase.set('leaving');
    }
  }

  finishLeave(): void {
    const id = this._selectedId();
    const item = this.items().find((candidate) => candidate.id() === id);

    this.pendingClose = false;
    this._selectedId.set(null);
    this._phase.set('idle');

    if (id !== null) {
      this.magazineClose.emit({ id, label: item?.label() ?? '' });
    }
  }

  private emitFor(target: { emit(value: MagazineCollectionEvent): void }): void {
    const id = this._selectedId();

    if (id === null) {
      return;
    }

    const item = this.items().find((candidate) => candidate.id() === id);
    target.emit({ id, label: item?.label() ?? '' });
  }
}