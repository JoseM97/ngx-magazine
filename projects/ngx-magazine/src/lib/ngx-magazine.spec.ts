import { Component } from '@angular/core';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { vi } from 'vitest';

import { NgxMagazine } from './ngx-magazine';
import { MagazinePage } from './magazine-page';

@Component({
  standalone: true,
  imports: [NgxMagazine, MagazinePage],
  template: `
    <ngx-magazine>
      <ng-template ngxMagazinePage>
        <h1>Portada</h1>
      </ng-template>

      <ng-template ngxMagazinePage>
        <h1>Página 2</h1>
      </ng-template>

      <ng-template ngxMagazinePage>
        <h1>Página 3</h1>
      </ng-template>
    </ngx-magazine>
  `,
})
class TestHost {}

@Component({
  standalone: true,
  imports: [NgxMagazine, MagazinePage],
  template: `
    <ngx-magazine>
      <ng-template ngxMagazinePage><h1>Portada</h1></ng-template>
    </ngx-magazine>
  `,
})
class OnePageHost {}

@Component({
  standalone: true,
  imports: [NgxMagazine, MagazinePage],
  template: `
    <ngx-magazine>
      <ng-template ngxMagazinePage><h1>Portada</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 2</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 3</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 4</h1></ng-template>
    </ngx-magazine>
  `,
})
class FourPagesHost {}

@Component({
  standalone: true,
  imports: [NgxMagazine, MagazinePage],
  template: `
    <ngx-magazine>
      <ng-template ngxMagazinePage><h1>Portada</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 2</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 3</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 4</h1></ng-template>
      <ng-template ngxMagazinePage><h1>Página 5</h1></ng-template>
    </ngx-magazine>
  `,
})
class FivePagesHost {}

type AnyFixture = ComponentFixture<unknown>;

function getMagazine(fixture: AnyFixture): NgxMagazine {
  return fixture.debugElement.query(
    (debugElement) => debugElement.componentInstance instanceof NgxMagazine,
  ).componentInstance as NgxMagazine;
}

function root(fixture: AnyFixture): HTMLElement {
  return fixture.nativeElement as HTMLElement;
}

function renderedPageIndexes(fixture: AnyFixture): number[] {
  return Array.from(root(fixture).querySelectorAll('[data-page-index]'))
    .map((element) => Number(element.getAttribute('data-page-index')))
    .sort((a, b) => a - b);
}

function renderedHeadings(fixture: AnyFixture): string[] {
  return Array.from(root(fixture).querySelectorAll('h1')).map(
    (heading) => heading.textContent?.trim() ?? '',
  );
}

function expectNoDuplicates(fixture: AnyFixture): void {
  const indexes = renderedPageIndexes(fixture);
  const headings = renderedHeadings(fixture);

  expect(new Set(indexes).size).toBe(indexes.length);
  expect(new Set(headings).size).toBe(headings.length);
}

function nonNull(values: (number | null)[]): number[] {
  return values
    .filter((value): value is number => value !== null)
    .sort((a, b) => a - b);
}

function fireTransitionEnd(element: Element, propertyName: string): void {
  const event = new Event('transitionend', { bubbles: true });

  Object.defineProperty(event, 'propertyName', {
    value: propertyName,
  });

  element.dispatchEvent(event);
}

/** Termina el giro en curso (también el de la tapa al abrir o cerrar). */
function finishFlip(fixture: AnyFixture) {
  fixture.detectChanges();

  const sheet = root(fixture).querySelector(
    '.magazine__flipping-sheet',
  ) as HTMLElement | null;

  expect(sheet).not.toBeNull();

  fireTransitionEnd(sheet!, 'transform');
  fixture.detectChanges();
}

function isShifted(fixture: AnyFixture): boolean {
  return root(fixture).querySelector('.magazine__content.is-shifted') !== null;
}

/** Abre la revista y espera a que la tapa termine de girar (pliego 1). */
function openMagazine(fixture: AnyFixture, magazine: NgxMagazine): void {
  magazine.open();
  fixture.detectChanges();
  finishFlip(fixture);
}

/**
 * Ejecuta un giro completo entre pliegos comprobando, a mitad de transición
 * y al final, que ninguna página se renderiza dos veces y que la composición
 * de las cuatro ranuras coincide con los pliegos de origen y de destino.
 * Retroceder desde el pliego 1 es cerrar la revista (la tapa vuelve).
 */
function flipAndCheck(
  fixture: AnyFixture,
  magazine: NgxMagazine,
  direction: 'next' | 'previous',
): void {
  const spreadBefore = magazine.currentSpread();
  const beforeLeft = magazine.leftPage();
  const beforeRight = magazine.rightPage();

  if (direction === 'next') {
    magazine.nextSpread();
  } else {
    magazine.previousSpread();
  }

  fixture.detectChanges();

  // --- A mitad de transición ---
  const c = magazine.composition();

  expect(magazine.isAnimating()).toBe(true);
  expect(magazine.currentSpread()).toBe(spreadBefore);
  expectNoDuplicates(fixture);
  expect(renderedPageIndexes(fixture)).toEqual(
    nonNull([c.left, c.right, c.front, c.back]),
  );

  if (direction === 'next') {
    expect(c.front).toBe(beforeRight);
    expect(c.left).toBe(beforeLeft);
  } else {
    expect(c.front).toBe(beforeLeft);
    expect(c.right).toBe(beforeRight);
  }

  // --- Al terminar ---
  finishFlip(fixture);

  const afterLeft = magazine.leftPage();
  const afterRight = magazine.rightPage();

  expect(magazine.isAnimating()).toBe(false);
  expect(magazine.currentSpread()).toBe(
    direction === 'next' ? spreadBefore + 1 : spreadBefore - 1,
  );

  if (direction === 'next') {
    expect(c.back).toBe(afterLeft);
    expect(c.right).toBe(afterRight);
  } else {
    expect(c.back).toBe(afterRight);
    expect(c.left).toBe(afterLeft);
  }

  expectNoDuplicates(fixture);
  expect(renderedPageIndexes(fixture)).toEqual(
    nonNull([afterLeft, afterRight]),
  );
}

/** Abre la revista comprobando la composición durante el giro de la tapa. */
function openAndCheck(fixture: AnyFixture, magazine: NgxMagazine): void {
  magazine.open();
  fixture.detectChanges();

  const c = magazine.composition();

  expect(magazine.state()).toBe('opening');
  expect(magazine.isAnimating()).toBe(true);
  expect(magazine.currentSpread()).toBe(0);
  expect(c.left).toBeNull();
  expect(c.front).toBe(0);
  expect(c.back).toBe(1);
  expectNoDuplicates(fixture);
  expect(renderedPageIndexes(fixture)).toEqual(
    nonNull([c.left, c.right, c.front, c.back]),
  );

  finishFlip(fixture);

  expect(magazine.state()).toBe('open');
  expect(magazine.currentSpread()).toBe(1);
  expectNoDuplicates(fixture);
  expect(renderedPageIndexes(fixture)).toEqual(
    nonNull([magazine.leftPage(), magazine.rightPage()]),
  );
}

describe('NgxMagazine', () => {
  it('should create', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should detect projected pages', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const magazine = getMagazine(fixture);
    expect(magazine.pages().length).toBe(3);
  });

  it('should open the magazine', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();
    const magazine = getMagazine(fixture);
    expect(magazine.isOpen()).toBe(false);
    expect(magazine.state()).toBe('closed');
    magazine.open();
    expect(magazine.isOpen()).toBe(true);
    expect(magazine.state()).toBe('opening');
  });

  it('should not open a magazine with a single page', async () => {
    const fixture = TestBed.createComponent(OnePageHost);
    await fixture.whenStable();
    fixture.detectChanges();
    const magazine = getMagazine(fixture);

    magazine.open();

    expect(magazine.state()).toBe('closed');
    expect(magazine.isOpen()).toBe(false);
    expect(
      (root(fixture).querySelector('.magazine__open') as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it('should navigate between spreads after the flip finishes', async () => {
    const fixture = TestBed.createComponent(FourPagesHost);
    await fixture.whenStable();

    const magazine = getMagazine(fixture);

    openMagazine(fixture, magazine);

    expect(magazine.currentSpread()).toBe(1);

    magazine.nextSpread();
    fixture.detectChanges();

    expect(magazine.currentSpread()).toBe(1);
    expect(magazine.isAnimating()).toBe(true);

    finishFlip(fixture);

    expect(magazine.currentSpread()).toBe(2);
    expect(magazine.isAnimating()).toBe(false);

    magazine.nextSpread();
    expect(magazine.currentSpread()).toBe(2);
  });

  it('should navigate backwards, and going back from spread 1 closes the book', async () => {
    const fixture = TestBed.createComponent(FourPagesHost);
    await fixture.whenStable();

    const magazine = getMagazine(fixture);

    openMagazine(fixture, magazine);

    magazine.nextSpread();
    fixture.detectChanges();
    finishFlip(fixture);

    expect(magazine.currentSpread()).toBe(2);

    magazine.previousSpread();
    fixture.detectChanges();

    expect(magazine.isAnimating()).toBe(true);
    expect(magazine.currentSpread()).toBe(2);

    finishFlip(fixture);

    expect(magazine.currentSpread()).toBe(1);
    expect(magazine.state()).toBe('open');

    magazine.previousSpread();
    fixture.detectChanges();

    expect(magazine.state()).toBe('closing');

    finishFlip(fixture);

    expect(magazine.currentSpread()).toBe(0);
    expect(magazine.state()).toBe('closed');
    expect(magazine.isAnimating()).toBe(false);
  });

  describe('static composition', () => {
    it('should render only the cover, centered, when closed', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      fixture.detectChanges();

      expect(renderedPageIndexes(fixture)).toEqual([0]);
      expect(
        root(fixture).querySelector('.magazine__static-page.magazine__front-cover'),
      ).not.toBeNull();
      expect(isShifted(fixture)).toBe(true);
    });

    it('should show the first spread, centered on the page, once opened', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);

      expect(magazine.composition()).toEqual({
        left: 1,
        right: 2,
        front: null,
        back: null,
      });
      expect(root(fixture).querySelector('.magazine__left')).not.toBeNull();
      expect(root(fixture).querySelector('.magazine__right')).not.toBeNull();
      expect(isShifted(fixture)).toBe(false);
    });
  });

  describe('cover open/close animation', () => {
    it('should keep the book centered until it is opened', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      fixture.detectChanges();
      const magazine = getMagazine(fixture);

      expect(isShifted(fixture)).toBe(true);
      expect(magazine.flip()).toBeNull();
      expect(magazine.currentSpread()).toBe(0);
    });

    it('should flip the cover as a lid with the right composition (3 pages)', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openAndCheck(fixture, magazine);
    });

    it('should flip the cover as a lid with the right composition (4 pages)', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openAndCheck(fixture, magazine);
    });

    it('should block navigation until the opening flip ends', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);
      const opened: unknown[] = [];
      magazine.opened.subscribe(() => opened.push(true));

      magazine.open();
      fixture.detectChanges();

      expect(magazine.state()).toBe('opening');
      expect(magazine.isAnimating()).toBe(true);
      expect(
        (root(fixture).querySelector('.magazine__previous') as HTMLButtonElement).disabled,
      ).toBe(true);

      magazine.nextSpread();
      expect(magazine.flip()?.targetSpread).toBe(1);

      finishFlip(fixture);

      expect(magazine.state()).toBe('open');
      expect(magazine.isAnimating()).toBe(false);
      expect(opened.length).toBe(1);
      expect(
        (root(fixture).querySelector('.magazine__next') as HTMLButtonElement).disabled,
      ).toBe(false);
    });

    it('should ignore transitionend from other properties or other elements', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      magazine.open();
      fixture.detectChanges();

      const sheet = root(fixture).querySelector('.magazine__flipping-sheet') as HTMLElement;
      const inner = sheet.querySelector('h1') as HTMLElement;

      fireTransitionEnd(sheet, 'opacity');
      fireTransitionEnd(inner, 'transform');

      expect(magazine.state()).toBe('opening');
    });

    it('should close with animation, go back to the cover and emit closed', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);
      const closed: unknown[] = [];
      const pageChanges: { currentSpread: number }[] = [];
      magazine.closed.subscribe(() => closed.push(true));
      magazine.pageChange.subscribe((event) => pageChanges.push(event));

      openMagazine(fixture, magazine);
      flipAndCheck(fixture, magazine, 'next');
      expect(magazine.currentSpread()).toBe(2);

      magazine.close();
      fixture.detectChanges();

      expect(magazine.state()).toBe('closing');
      expect(magazine.isOpen()).toBe(false);
      // Desde cualquier pliego se salta al 1 y la tapa gira hacia atrás.
      expect(magazine.currentSpread()).toBe(1);
      expect(magazine.composition()).toEqual({
        left: null,
        right: 2,
        front: 1,
        back: 0,
      });
      expectNoDuplicates(fixture);
      expect(closed.length).toBe(0);

      finishFlip(fixture);

      expect(magazine.state()).toBe('closed');
      expect(magazine.currentSpread()).toBe(0);
      expect(closed.length).toBe(1);
      expect(pageChanges[pageChanges.length - 1].currentSpread).toBe(0);
      expect(renderedPageIndexes(fixture)).toEqual([0]);
      expect(isShifted(fixture)).toBe(true);
    });

    it('should always reopen from the cover', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      flipAndCheck(fixture, magazine, 'next');

      magazine.close();
      fixture.detectChanges();
      finishFlip(fixture);

      openMagazine(fixture, magazine);

      expect(magazine.currentSpread()).toBe(1);
      expect(magazine.composition().left).toBe(1);
      expect(magazine.composition().right).toBe(2);
    });

    it('should ignore close() when it is not open or an animation is running', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      magazine.close();
      expect(magazine.state()).toBe('closed');

      magazine.open();
      magazine.close();
      expect(magazine.state()).toBe('opening');
      expect(magazine.isOpen()).toBe(true);
    });

    it('should complete opening and closing by itself if transitionend never arrives', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      vi.useFakeTimers();
      try {
        magazine.open();
        expect(magazine.state()).toBe('opening');
        vi.advanceTimersByTime(2000);
        expect(magazine.state()).toBe('open');

        magazine.close();
        expect(magazine.state()).toBe('closing');
        vi.advanceTimersByTime(2000);
        expect(magazine.state()).toBe('closed');
      } finally {
        vi.useRealTimers();
      }
    });

    it('should reset instantly, without animation', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      magazine.nextSpread();
      fixture.detectChanges();

      magazine.reset();
      fixture.detectChanges();

      expect(magazine.state()).toBe('closed');
      expect(magazine.isOpen()).toBe(false);
      expect(magazine.isAnimating()).toBe(false);
      expect(magazine.currentSpread()).toBe(0);
      expect(magazine.flip()).toBeNull();
      expect(isShifted(fixture)).toBe(true);
    });

    it('should show the open button only when closed (standalone)', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      fixture.detectChanges();
      const magazine = getMagazine(fixture);

      expect(root(fixture).querySelector('.magazine__open')).not.toBeNull();

      magazine.open();
      fixture.detectChanges();
      expect(root(fixture).querySelector('.magazine__open')).toBeNull();

      finishFlip(fixture);
      magazine.close();
      fixture.detectChanges();
      expect(root(fixture).querySelector('.magazine__open')).toBeNull();

      finishFlip(fixture);
      expect(root(fixture).querySelector('.magazine__open')).not.toBeNull();
    });
  });

  describe('flip composition (no duplicated pages)', () => {
    const cases = [
      { name: '3 pages', host: TestHost, spreads: 2 },
      { name: '4 pages (last page without a pair)', host: FourPagesHost, spreads: 3 },
      { name: '5 pages', host: FivePagesHost, spreads: 3 },
    ];

    for (const { name, host, spreads } of cases) {
      it(`should never render a page twice opening, going forward, back and closing with ${name}`, async () => {
        const fixture = TestBed.createComponent(host);
        await fixture.whenStable();
        const magazine = getMagazine(fixture);

        expect(magazine.totalSpreads()).toBe(spreads);
        expectNoDuplicates(fixture);

        openAndCheck(fixture, magazine);

        for (let i = 0; i < spreads - 2; i++) {
          flipAndCheck(fixture, magazine, 'next');
        }

        expect(magazine.canGoNext()).toBe(false);

        for (let i = 0; i < spreads - 2; i++) {
          flipAndCheck(fixture, magazine, 'previous');
        }

        expect(magazine.currentSpread()).toBe(1);

        // Desde el pliego 1, ‹ cierra el libro.
        flipAndCheck(fixture, magazine, 'previous');

        expect(magazine.currentSpread()).toBe(0);
        expect(magazine.state()).toBe('closed');
        expect(magazine.canGoPrevious()).toBe(false);
      });
    }

    it('should leave the right half empty on the last spread of a 4-page magazine', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      flipAndCheck(fixture, magazine, 'next');

      expect(magazine.leftPage()).toBe(3);
      expect(magazine.rightPage()).toBeNull();
    });

    it('should not render the target left page on the right half when going back from the last spread', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      flipAndCheck(fixture, magazine, 'next');

      magazine.previousSpread();
      fixture.detectChanges();

      const staticRight = root(fixture).querySelector('.magazine__right');
      const staticLeft = root(fixture).querySelector('.magazine__left');

      // Spread 2 -> 1: la página de la derecha actual no existe,
      // y la de destino (índice 1) va a la izquierda, no a la derecha.
      expect(staticRight).toBeNull();
      expect(staticLeft?.getAttribute('data-page-index')).toBe('1');
    });

    it('should not show the incoming page 2 on the left when going back to the cover', async () => {
      const fixture = TestBed.createComponent(TestHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);

      magazine.previousSpread();
      fixture.detectChanges();

      // Página 2 (índice 1) solo en la hoja; la izquierda estática está vacía.
      expect(magazine.composition()).toEqual({
        left: null,
        right: 2,
        front: 1,
        back: 0,
      });
      expect(renderedHeadings(fixture).filter((t) => t === 'Página 2').length).toBe(1);
    });
  });

  describe('transition state', () => {
    it('should emit pageChange only when each flip finishes', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      const events: unknown[] = [];
      magazine.pageChange.subscribe((event) => events.push(event));

      magazine.open();
      fixture.detectChanges();
      expect(events.length).toBe(0);

      finishFlip(fixture);
      expect(events.length).toBe(1);
      expect(events[0]).toEqual({
        currentSpread: 1,
        totalSpreads: 3,
        leftPage: 1,
        rightPage: 2,
      });

      magazine.nextSpread();
      fixture.detectChanges();
      expect(events.length).toBe(1);

      finishFlip(fixture);

      expect(events.length).toBe(2);
      expect(events[1]).toEqual({
        currentSpread: 2,
        totalSpreads: 3,
        leftPage: 3,
        rightPage: null,
      });
    });

    it('should block controls and ignored calls while a flip is running', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      magazine.nextSpread();
      fixture.detectChanges();

      const next = root(fixture).querySelector('.magazine__next') as HTMLButtonElement;
      const previous = root(fixture).querySelector('.magazine__previous') as HTMLButtonElement;

      expect(next.disabled).toBe(true);
      expect(previous.disabled).toBe(true);

      magazine.nextSpread();
      magazine.previousSpread();
      magazine.close();

      expect(magazine.flip()?.targetSpread).toBe(2);
      expect(magazine.isOpen()).toBe(true);
      expect(magazine.state()).toBe('open');
    });

    it('should ignore transitionend events from other elements or properties', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      magazine.nextSpread();
      fixture.detectChanges();

      const sheet = root(fixture).querySelector('.magazine__flipping-sheet') as HTMLElement;
      fireTransitionEnd(sheet, 'opacity');

      expect(magazine.isAnimating()).toBe(true);
      expect(magazine.currentSpread()).toBe(1);
    });

    it('should start the CSS transition after the first render', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);
      magazine.nextSpread();
      fixture.detectChanges();
      await fixture.whenStable();
      fixture.detectChanges();

      expect(magazine.flip()?.progress).toBe(true);
      expect(
        root(fixture).querySelector('.magazine__flipping-sheet.is-flipping'),
      ).not.toBeNull();
    });

    it('should complete the flip by itself if transitionend never arrives', async () => {
      const fixture = TestBed.createComponent(FourPagesHost);
      await fixture.whenStable();
      const magazine = getMagazine(fixture);

      openMagazine(fixture, magazine);

      vi.useFakeTimers();
      try {
        magazine.nextSpread();
        expect(magazine.isAnimating()).toBe(true);
        vi.advanceTimersByTime(2000);
      } finally {
        vi.useRealTimers();
      }

      expect(magazine.isAnimating()).toBe(false);
      expect(magazine.currentSpread()).toBe(2);
    });
  });
});