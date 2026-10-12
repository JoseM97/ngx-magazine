import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { MagazinePage } from './magazine-page';
import { NgxMagazine } from './ngx-magazine';
import { NgxMagazineCollection } from './magazine-collection';
import { NgxMagazineItem } from './magazine-item';

@Component({
  standalone: true,
  imports: [NgxMagazineCollection, NgxMagazineItem, NgxMagazine, MagazinePage],
  template: `
    <ngx-magazine-collection [columns]="2" [tilt]="30" gap="2rem">
      <ngx-magazine-item id="a" label="Revista A" spineColor="#aa0000">
        <ngx-magazine>
          <ng-template ngxMagazinePage><h1>Portada A</h1></ng-template>
          <ng-template ngxMagazinePage><h2>Interior A</h2></ng-template>
          <ng-template ngxMagazinePage><h2>Interior A2</h2></ng-template>
          <ng-template ngxMagazinePage><h2>Interior A3</h2></ng-template>
        </ngx-magazine>
      </ngx-magazine-item>

      <ngx-magazine-item id="b" label="Revista B" burstText="">
        <ngx-magazine>
          <ng-template ngxMagazinePage><h1>Portada B</h1></ng-template>
          <ng-template ngxMagazinePage><h2>Interior B</h2></ng-template>
        </ngx-magazine>
      </ngx-magazine-item>

      <ngx-magazine-item id="c" label="Revista C" burstText="¡Nuevo!">
        <ngx-magazine>
          <ng-template ngxMagazinePage><h1>Portada C</h1></ng-template>
        </ngx-magazine>
      </ngx-magazine-item>
    </ngx-magazine-collection>
  `,
})
class CollectionHost {}

type AnyFixture = ComponentFixture<unknown>;

function root(fixture: AnyFixture): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function getCollection(fixture: AnyFixture): NgxMagazineCollection {
  return fixture.debugElement.query(
    (debugElement) => debugElement.componentInstance instanceof NgxMagazineCollection,
  ).componentInstance as NgxMagazineCollection;
}

function magazineAt(fixture: AnyFixture, index: number): NgxMagazine {
  return fixture.debugElement.queryAll(
    (debugElement) => debugElement.componentInstance instanceof NgxMagazine,
  )[index].componentInstance as NgxMagazine;
}

function covers(fixture: AnyFixture): HTMLElement[] {
  return Array.from(root(fixture).querySelectorAll('.item__cover'));
}

function dialog(fixture: AnyFixture): HTMLElement | null {
  return root(fixture).querySelector('dialog.modal');
}

function fireTransitionEnd(element: Element, propertyName: string): void {
  const event = new Event('transitionend', { bubbles: true });
  Object.defineProperty(event, 'propertyName', { value: propertyName });
  element.dispatchEvent(event);
}

/** Varias pasadas: los efectos del item cambian señales que requieren otra. */
function cdAll(fixture: AnyFixture): void {
  fixture.detectChanges();
  fixture.detectChanges();
  fixture.detectChanges();
}

/** Dispara el fin de la transición de transform de la caja de la modal. */
function endModalTransition(fixture: AnyFixture): void {
  const book = root(fixture).querySelector('.modal__book') as HTMLElement;
  fireTransitionEnd(book, 'transform');
  cdAll(fixture);
}

function modalNext(fixture: AnyFixture): HTMLButtonElement {
  return root(fixture).querySelector('.modal__book .magazine__next') as HTMLButtonElement;
}

/** Pulsa › en la modal: con la revista cerrada, la abre. */
function clickNext(fixture: AnyFixture): void {
  modalNext(fixture).click();
  cdAll(fixture);
}

/** Termina el giro en curso dentro de la modal (apertura, cierre o página). */
function endFlip(fixture: AnyFixture): void {
  fixture.detectChanges();

  const sheet = root(fixture).querySelector(
    '.modal__book .magazine__flipping-sheet',
  ) as HTMLElement;

  fireTransitionEnd(sheet, 'transform');
  cdAll(fixture);
}

/** Selecciona una revista, espera a la modal y la abre hasta `reading`. */
function toReading(
  fixture: AnyFixture,
  collection: NgxMagazineCollection,
  id: string,
): void {
  collection.select(id);
  fixture.detectChanges();
  endModalTransition(fixture); // entering → shown
  clickNext(fixture); // el usuario abre: shown → opening
  endFlip(fixture); // opening → reading
}

/**
 * Pulsa una tecla en la modal. Devuelve el evento para poder comprobar
 * `defaultPrevented`. Por defecto el evento nace en el propio diálogo.
 */
function pressKey(
  fixture: AnyFixture,
  key: string,
  init: KeyboardEventInit = {},
  target: Element | null = dialog(fixture),
): KeyboardEvent {
  const event = new KeyboardEvent('keydown', {
    key,
    bubbles: true,
    cancelable: true,
    ...init,
  });

  target!.dispatchEvent(event);
  cdAll(fixture);

  return event;
}

async function setup() {
  const fixture = TestBed.createComponent(CollectionHost);
  await fixture.whenStable();
  fixture.detectChanges();
  return fixture;
}

describe('NgxMagazineCollection', () => {
  it('should render one cover per item using page 0 only', async () => {
    const fixture = await setup();

    expect(covers(fixture).length).toBe(3);

    const headings = Array.from(root(fixture).querySelectorAll('h1')).map(
      (heading) => heading.textContent?.trim(),
    );

    expect(headings).toEqual(['Portada A', 'Portada B', 'Portada C']);
    expect(root(fixture).querySelectorAll('h2').length).toBe(0);
  });

  it('should expose an accessible name and role on each cover', async () => {
    const fixture = await setup();
    const [first] = covers(fixture);

    expect(first.getAttribute('role')).toBe('button');
    expect(first.getAttribute('aria-label')).toBe('Revista A');
    expect(first.getAttribute('tabindex')).toBe('0');
  });

  it('should select a magazine on click and emit magazineSelect', async () => {
    const fixture = await setup();
    const collection = getCollection(fixture);
    const events: unknown[] = [];
    collection.magazineSelect.subscribe((event) => events.push(event));

    covers(fixture)[1].click();
    fixture.detectChanges();

    expect(collection.selectedId()).toBe('b');
    expect(events).toEqual([{ id: 'b', label: 'Revista B' }]);
    expect(covers(fixture)[1].getAttribute('aria-pressed')).toBe('true');
    expect(covers(fixture)[0].getAttribute('aria-pressed')).toBe('false');
    expect(root(fixture).querySelectorAll('ngx-magazine-item.is-selected').length).toBe(1);
  });

  it('should select with Enter and Space', async () => {
    const fixture = await setup();
    const collection = getCollection(fixture);

    covers(fixture)[0].dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    fixture.detectChanges();
    expect(collection.selectedId()).toBe('a');

    // Volver a la mesa antes de seleccionar otra revista.
    collection.close();
    fixture.detectChanges();
    endModalTransition(fixture);
    expect(collection.selectedId()).toBeNull();

    covers(fixture)[2].dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    fixture.detectChanges();
    expect(collection.selectedId()).toBe('c');
  });

  it('should not emit again when selecting the already selected magazine', async () => {
    const fixture = await setup();
    const collection = getCollection(fixture);
    const events: unknown[] = [];
    collection.magazineSelect.subscribe((event) => events.push(event));

    collection.select('a');
    collection.select('a');

    expect(events.length).toBe(1);
  });

  it('should ignore unknown ids', async () => {
    const fixture = await setup();
    const collection = getCollection(fixture);
    const events: unknown[] = [];
    collection.magazineSelect.subscribe((event) => events.push(event));

    collection.select('zzz');

    expect(collection.selectedId()).toBeNull();
    expect(collection.phase()).toBe('idle');
    expect(events.length).toBe(0);
  });

  it('should start leaving on close() and emit magazineClose only when it finishes', async () => {
    const fixture = await setup();
    const collection = getCollection(fixture);
    const closed: unknown[] = [];
    collection.magazineClose.subscribe((event) => closed.push(event));

    collection.close();
    expect(closed.length).toBe(0);
    expect(collection.phase()).toBe('idle');

    collection.select('c');
    collection.close();
    fixture.detectChanges();

    expect(collection.phase()).toBe('leaving');
    expect(collection.selectedId()).toBe('c');
    expect(closed.length).toBe(0);

    collection.finishLeave();
    fixture.detectChanges();

    expect(collection.selectedId()).toBeNull();
    expect(collection.phase()).toBe('idle');
    expect(closed).toEqual([{ id: 'c', label: 'Revista C' }]);
    expect(root(fixture).querySelectorAll('ngx-magazine-item.is-selected').length).toBe(0);
  });

  it('should pass columns, tilt and gap to the grid as CSS variables', async () => {
    const fixture = await setup();
    const grid = root(fixture).querySelector('.grid') as HTMLElement;

    expect(grid.style.getPropertyValue('--ngx-magazine-cols')).toBe('2');
    expect(grid.style.getPropertyValue('--ngx-magazine-tilt')).toBe('30deg');
    expect(grid.style.getPropertyValue('--ngx-magazine-gap')).toBe('2rem');
  });

  describe('3D book', () => {
    it('should render the six faces of the book for every item', async () => {
      const fixture = await setup();

      for (const item of Array.from(root(fixture).querySelectorAll('ngx-magazine-item'))) {
        const faces = Array.from(item.querySelectorAll('.book__face')).map((face) =>
          Array.from(face.classList).find((c) => c !== 'book__face'),
        );

        expect(faces.sort()).toEqual(
          ['book__back', 'book__bottom', 'book__edge', 'book__front', 'book__spine', 'book__top'].sort(),
        );
      }
    });

    it('should render the cover content only on the front face', async () => {
      const fixture = await setup();
      const firstItem = root(fixture).querySelector('ngx-magazine-item') as HTMLElement;

      expect(firstItem.querySelectorAll('.book__front h1').length).toBe(1);
      expect(firstItem.querySelectorAll('.book__face h1').length).toBe(1);
    });

    it('should apply spineColor to the spine and back faces', async () => {
      const fixture = await setup();
      const firstItem = root(fixture).querySelector('ngx-magazine-item') as HTMLElement;
      const spine = firstItem.querySelector('.book__spine') as HTMLElement;
      const back = firstItem.querySelector('.book__back') as HTMLElement;

      expect(spine.style.backgroundColor).not.toBe('');
      expect(back.style.backgroundColor).toBe(spine.style.backgroundColor);
    });
  });

  describe('comic burst', () => {
    function burstTexts(fixture: AnyFixture): (string | null)[] {
      return Array.from(root(fixture).querySelectorAll('ngx-magazine-item')).map(
        (item) =>
          item.querySelector('.item__burst-text')?.textContent?.trim() ?? null,
      );
    }

    it('should show the label by default, a custom text, or nothing', async () => {
      const fixture = await setup();

      expect(burstTexts(fixture)).toEqual(['Revista A', null, '¡Nuevo!']);
    });

    it('should keep the accessible name from label, not from burstText', async () => {
      const fixture = await setup();

      expect(covers(fixture)[2].getAttribute('aria-label')).toBe('Revista C');
    });

    it('should hide the burst from assistive technology', async () => {
      const fixture = await setup();
      const burst = root(fixture).querySelector('.item__burst') as HTMLElement;

      expect(burst.getAttribute('aria-hidden')).toBe('true');
    });
  });

  describe('modal', () => {
    it('should not render any dialog while idle', async () => {
      const fixture = await setup();

      expect(dialog(fixture)).toBeNull();
    });

    it('should render the real, closed and centered magazine inside the dialog', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('b');
      fixture.detectChanges();

      const modal = dialog(fixture);

      expect(collection.phase()).toBe('entering');
      expect(modal).not.toBeNull();
      expect(modal!.getAttribute('aria-label')).toBe('Revista B');
      expect(modal!.querySelector('ngx-magazine')).not.toBeNull();
      expect(modal!.querySelectorAll('h1').length).toBe(1);
      expect(modal!.querySelector('h1')?.textContent?.trim()).toBe('Portada B');
      expect(modal!.querySelectorAll('h2').length).toBe(0);
      expect(root(fixture).querySelectorAll('dialog').length).toBe(1);
      expect(magazineAt(fixture, 1).state()).toBe('closed');
      expect(modal!.querySelector('.magazine__content.is-shifted')).not.toBeNull();
    });

    it('should not show the "open" button of the magazine inside a collection', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();

      expect(dialog(fixture)!.querySelector('.magazine__open')).toBeNull();
    });

    it('should ignore selecting another magazine while one is open', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const events: unknown[] = [];
      collection.magazineSelect.subscribe((event) => events.push(event));

      collection.select('a');
      collection.select('b');
      fixture.detectChanges();

      expect(collection.selectedId()).toBe('a');
      expect(events.length).toBe(1);

      endModalTransition(fixture);
      collection.select('c');

      expect(collection.selectedId()).toBe('a');
      expect(events.length).toBe(1);
    });

    it('should ignore transitionend events from other properties', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();

      const book = root(fixture).querySelector('.modal__book') as HTMLElement;
      fireTransitionEnd(book, 'opacity');

      expect(collection.phase()).toBe('entering');
    });

    it('should close with the close button while still closed and finish after the leave transition', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const closed: unknown[] = [];
      collection.magazineClose.subscribe((event) => closed.push(event));

      collection.select('a');
      fixture.detectChanges();

      (root(fixture).querySelector('.modal__close') as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(collection.phase()).toBe('leaving');
      expect(closed.length).toBe(0);
      expect(dialog(fixture)).not.toBeNull();

      endModalTransition(fixture);

      expect(collection.phase()).toBe('idle');
      expect(collection.selectedId()).toBeNull();
      expect(closed).toEqual([{ id: 'a', label: 'Revista A' }]);
      expect(dialog(fixture)).toBeNull();
    });

    it('should close when clicking outside the magazine but not on it', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      (root(fixture).querySelector('.modal__book') as HTMLElement).click();
      fixture.detectChanges();
      expect(collection.phase()).toBe('reading');

      (root(fixture).querySelector('.modal__stage') as HTMLElement).click();
      fixture.detectChanges();
      expect(collection.phase()).toBe('closing');
    });

    it('should restore the page scroll after closing', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const html = document.documentElement;
      const before = html.style.overflow;

      collection.select('a');
      fixture.detectChanges();
      collection.close();
      fixture.detectChanges();
      endModalTransition(fixture);

      expect(html.style.overflow).toBe(before);
    });
  });

  describe('opening on demand and reading', () => {
    it('should keep the magazine closed and centered until the user opens it', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      expect(collection.phase()).toBe('shown');
      expect(magazineAt(fixture, 0).state()).toBe('closed');
      expect(root(fixture).querySelector('.modal__book .magazine__flipping-sheet')).toBeNull();
      expect(root(fixture).querySelector('.modal__book .magazine__content.is-shifted')).not.toBeNull();
    });

    it('should keep › disabled until the modal is shown', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();

      expect(modalNext(fixture).disabled).toBe(true);

      endModalTransition(fixture);

      expect(modalNext(fixture).disabled).toBe(false);
    });

    it('should open with › as a lid flip and emit magazineOpen', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const opened: unknown[] = [];
      collection.magazineOpen.subscribe((event) => opened.push(event));

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);
      expect(opened.length).toBe(0);

      clickNext(fixture);

      expect(collection.phase()).toBe('opening');
      expect(magazineAt(fixture, 0).state()).toBe('opening');
      expect(root(fixture).querySelector('.modal__book .magazine__flipping-sheet')).not.toBeNull();
      expect(modalNext(fixture).disabled).toBe(true);
      expect(opened.length).toBe(0);

      endFlip(fixture);

      expect(collection.phase()).toBe('reading');
      expect(magazineAt(fixture, 0).state()).toBe('open');
      expect(magazineAt(fixture, 0).currentSpread()).toBe(1);
      expect(opened).toEqual([{ id: 'a', label: 'Revista A' }]);
      expect(root(fixture).querySelector('.modal__book .magazine__content.is-shifted')).toBeNull();
    });

    it('should open when clicking on the closed cover', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      (root(fixture).querySelector('.modal__book .magazine__static-page') as HTMLElement).click();
      cdAll(fixture);

      expect(magazineAt(fixture, 0).state()).toBe('opening');
      expect(collection.phase()).toBe('opening');
    });

    it('should not open when clicking the cover before the modal is shown', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();

      (root(fixture).querySelector('.modal__book .magazine__static-page') as HTMLElement).click();
      cdAll(fixture);

      expect(magazineAt(fixture, 0).state()).toBe('closed');
      expect(collection.phase()).toBe('entering');
    });

    it('should let the user flip pages with the existing engine while reading', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);
      magazine.nextSpread();
      fixture.detectChanges();
      endFlip(fixture);

      expect(magazine.currentSpread()).toBe(2);
      expect(collection.phase()).toBe('reading');
    });

    it('should defer a close requested while the magazine is still opening', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);
      clickNext(fixture);
      expect(collection.phase()).toBe('opening');

      collection.close();
      expect(collection.phase()).toBe('opening');

      endFlip(fixture);

      expect(collection.phase()).toBe('closing');
    });

    it('should let the user go back to the cover with ‹ and reopen without leaving the modal', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);

      (root(fixture).querySelector('.modal__book .magazine__previous') as HTMLButtonElement).click();
      cdAll(fixture);
      expect(magazine.state()).toBe('closing');

      endFlip(fixture);

      expect(magazine.state()).toBe('closed');
      expect(magazine.currentSpread()).toBe(0);
      expect(collection.phase()).toBe('reading');
      expect(dialog(fixture)).not.toBeNull();
      expect(modalNext(fixture).disabled).toBe(false);

      clickNext(fixture);
      endFlip(fixture);

      expect(magazine.state()).toBe('open');
      expect(magazine.currentSpread()).toBe(1);
      expect(collection.phase()).toBe('reading');
    });
  });

  describe('closing and returning', () => {
    it('should close the magazine from the cover, then leave and emit magazineClose', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const closed: unknown[] = [];
      collection.magazineClose.subscribe((event) => closed.push(event));

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);
      magazine.nextSpread();
      fixture.detectChanges();
      endFlip(fixture);
      expect(magazine.currentSpread()).toBe(2);

      // Escape (cancel) → cierre animado.
      const cancel = new Event('cancel', { cancelable: true });
      dialog(fixture)!.dispatchEvent(cancel);
      cdAll(fixture);

      expect(cancel.defaultPrevented).toBe(true);
      expect(collection.phase()).toBe('closing');
      expect(magazine.state()).toBe('closing');
      // Se salta al pliego 1 y la tapa gira hacia atrás.
      expect(magazine.currentSpread()).toBe(1);
      expect(closed.length).toBe(0);

      endFlip(fixture); // la tapa se cierra y el libro vuelve al centro

      expect(magazine.state()).toBe('closed');
      expect(magazine.currentSpread()).toBe(0);
      expect(collection.phase()).toBe('leaving');
      expect(closed.length).toBe(0);

      endModalTransition(fixture); // la modal se desvanece

      expect(collection.phase()).toBe('idle');
      expect(collection.selectedId()).toBeNull();
      expect(closed).toEqual([{ id: 'a', label: 'Revista A' }]);
      expect(dialog(fixture)).toBeNull();
    });

    it('should close straight away when the magazine is still closed (shown)', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const closed: unknown[] = [];
      collection.magazineClose.subscribe((event) => closed.push(event));

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);
      expect(collection.phase()).toBe('shown');

      collection.close();
      cdAll(fixture);
      expect(collection.phase()).toBe('leaving');

      endModalTransition(fixture);

      expect(collection.phase()).toBe('idle');
      expect(closed.length).toBe(1);
      expect(dialog(fixture)).toBeNull();
    });

    it('should wait for a running flip before closing the magazine', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);
      magazine.nextSpread();
      fixture.detectChanges();
      expect(magazine.isAnimating()).toBe(true);

      collection.close();
      cdAll(fixture);

      // El giro sigue en curso: la revista aún no se ha cerrado.
      expect(collection.phase()).toBe('closing');
      expect(magazine.state()).toBe('open');

      endFlip(fixture);

      expect(magazine.state()).toBe('closing');
      expect(magazine.currentSpread()).toBe(1);
    });

    it('should reopen a magazine from its cover', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');
      const magazine = magazineAt(fixture, 0);
      magazine.nextSpread();
      fixture.detectChanges();
      endFlip(fixture);

      collection.close();
      cdAll(fixture);
      endFlip(fixture);
      endModalTransition(fixture);
      expect(collection.phase()).toBe('idle');

      toReading(fixture, collection, 'a');

      expect(magazine.currentSpread()).toBe(1);
      expect(magazine.composition().left).toBe(1);
      expect(magazine.composition().right).toBe(2);
    });

    it('should advance every phase by itself if transitionend never arrives', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);
      const closed: unknown[] = [];
      collection.magazineClose.subscribe((event) => closed.push(event));

      vi.useFakeTimers();
      try {
        collection.select('a');
        fixture.detectChanges();

        // Sin eventos de transición, la modal llega a `shown` por temporizador.
        for (let i = 0; i < 6 && collection.phase() !== 'shown'; i++) {
          vi.advanceTimersByTime(2000);
          cdAll(fixture);
        }
        expect(collection.phase()).toBe('shown');

        // La apertura la inicia el usuario; el giro termina por temporizador.
        clickNext(fixture);

        for (let i = 0; i < 6 && collection.phase() !== 'reading'; i++) {
          vi.advanceTimersByTime(2000);
          cdAll(fixture);
        }
        expect(collection.phase()).toBe('reading');

        collection.close();

        // Lo mismo al cerrar: se llega a `idle` solo con temporizadores.
        for (let i = 0; i < 8 && collection.phase() !== 'idle'; i++) {
          cdAll(fixture);
          vi.advanceTimersByTime(2000);
        }
      } finally {
        vi.useRealTimers();
      }

      cdAll(fixture);

      expect(collection.phase()).toBe('idle');
      expect(collection.selectedId()).toBeNull();
      expect(closed.length).toBe(1);
      expect(dialog(fixture)).toBeNull();
    });
  });

  describe('keyboard', () => {
    it('should open the magazine with ArrowRight once the modal is shown', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      const event = pressKey(fixture, 'ArrowRight');

      expect(event.defaultPrevented).toBe(true);
      expect(magazineAt(fixture, 0).state()).toBe('opening');
      expect(collection.phase()).toBe('opening');

      endFlip(fixture);

      expect(collection.phase()).toBe('reading');
      expect(magazineAt(fixture, 0).currentSpread()).toBe(1);
    });

    it('should ignore the arrows while the modal is still appearing', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();

      const event = pressKey(fixture, 'ArrowRight');

      expect(event.defaultPrevented).toBe(false);
      expect(magazineAt(fixture, 0).state()).toBe('closed');
      expect(collection.phase()).toBe('entering');
    });

    it('should go forward and back with the arrows while reading', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);
      expect(magazine.currentSpread()).toBe(1);

      pressKey(fixture, 'ArrowRight');
      expect(magazine.isAnimating()).toBe(true);
      endFlip(fixture);
      expect(magazine.currentSpread()).toBe(2);

      pressKey(fixture, 'ArrowLeft');
      expect(magazine.isAnimating()).toBe(true);
      endFlip(fixture);
      expect(magazine.currentSpread()).toBe(1);
      expect(collection.phase()).toBe('reading');
    });

    it('should close the book with ArrowLeft from spread 1 and reopen it with ArrowRight', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);

      pressKey(fixture, 'ArrowLeft');
      expect(magazine.state()).toBe('closing');
      endFlip(fixture);

      expect(magazine.state()).toBe('closed');
      expect(collection.phase()).toBe('reading');
      expect(dialog(fixture)).not.toBeNull();

      pressKey(fixture, 'ArrowRight');
      expect(magazine.state()).toBe('opening');
      endFlip(fixture);

      expect(magazine.state()).toBe('open');
      expect(magazine.currentSpread()).toBe(1);
    });

    it('should do nothing with ArrowLeft while the magazine is closed', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      pressKey(fixture, 'ArrowLeft');

      expect(magazineAt(fixture, 0).state()).toBe('closed');
      expect(collection.phase()).toBe('shown');
    });

    it('should ignore the arrows while a flip is running', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);

      pressKey(fixture, 'ArrowRight');
      expect(magazine.flip()?.targetSpread).toBe(2);

      pressKey(fixture, 'ArrowRight');
      pressKey(fixture, 'ArrowLeft');
      expect(magazine.flip()?.targetSpread).toBe(2);

      endFlip(fixture);

      expect(magazine.currentSpread()).toBe(2);
    });

    it('should not stop at the last spread', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      toReading(fixture, collection, 'a');

      const magazine = magazineAt(fixture, 0);

      pressKey(fixture, 'ArrowRight');
      endFlip(fixture);
      expect(magazine.currentSpread()).toBe(2);

      pressKey(fixture, 'ArrowRight');

      expect(magazine.currentSpread()).toBe(2);
      expect(magazine.isAnimating()).toBe(false);
    });

    it('should ignore the arrows with modifier keys', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      for (const init of [
        { ctrlKey: true },
        { altKey: true },
        { metaKey: true },
        { shiftKey: true },
      ]) {
        const event = pressKey(fixture, 'ArrowRight', init);
        expect(event.defaultPrevented).toBe(false);
      }

      expect(magazineAt(fixture, 0).state()).toBe('closed');
    });

    it('should ignore the arrows coming from form fields, video or audio', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      const stage = root(fixture).querySelector('.modal__stage') as HTMLElement;

      for (const tag of ['input', 'textarea', 'select', 'video', 'audio']) {
        const element = document.createElement(tag);
        stage.appendChild(element);

        const event = pressKey(fixture, 'ArrowRight', {}, element);

        expect(event.defaultPrevented).toBe(false);
        expect(magazineAt(fixture, 0).state()).toBe('closed');

        element.remove();
      }
    });

    it('should ignore other keys and not touch Escape handling', async () => {
      const fixture = await setup();
      const collection = getCollection(fixture);

      collection.select('a');
      fixture.detectChanges();
      endModalTransition(fixture);

      const event = pressKey(fixture, 'ArrowUp');

      expect(event.defaultPrevented).toBe(false);
      expect(magazineAt(fixture, 0).state()).toBe('closed');

      const cancel = new Event('cancel', { cancelable: true });
      dialog(fixture)!.dispatchEvent(cancel);
      cdAll(fixture);

      expect(cancel.defaultPrevented).toBe(true);
      expect(collection.phase()).toBe('leaving');
    });
  });
});