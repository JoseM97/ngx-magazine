# ngx-magazine

Angular components to show HTML content as an interactive magazine with a realistic 3D page flip, plus a 3D "table" collection where each magazine opens in a modal.

- Pages are plain `ng-template`s: text, images, video or Angular components.
- Standalone components, signals, no external dependencies.
- Respects `prefers-reduced-motion`.

## Installation

```bash
npm install ngx-magazine
```

Requires `@angular/core` and `@angular/common` `^22.2.0`.

## A single magazine

```ts
import { Component } from '@angular/core';
import { MagazinePage, NgxMagazine } from 'ngx-magazine';

@Component({
  selector: 'app-example',
  imports: [NgxMagazine, MagazinePage],
  template: `
    <ngx-magazine (pageChange)="onChange($event)">
      <ng-template ngxMagazinePage><h1>Cover</h1></ng-template>
      <ng-template ngxMagazinePage><h2>Page 2</h2></ng-template>
      <ng-template ngxMagazinePage><h2>Page 3</h2></ng-template>
    </ngx-magazine>
  `,
})
export class Example {
  onChange(event: unknown) {}
}
```

Each `ng-template` is one page. The first one is the cover. The magazine starts closed with the cover centered; the "Open" button (or `open()`) turns the cover like a lid. A magazine needs at least 2 pages to open.

### `NgxMagazine` API

| Member | Description |
| --- | --- |
| `(pageChange)` | Emits `{ currentSpread, totalSpreads, leftPage, rightPage }` when a flip finishes. |
| `(opened)` / `(closed)` | The cover finished opening / closing. |
| `open()` | Opens the magazine (cover flips to spread 1). |
| `close()` | Closes it, always from the cover. From any spread it goes to spread 1 and the cover flips back. |
| `reset()` | Closes instantly, without animation. |
| `nextSpread()` / `previousSpread()` | Navigate. `previousSpread()` on spread 1 closes the book. |
| `state()` | `'closed' \| 'opening' \| 'open' \| 'closing'`. |
| `isAnimating()` | `true` while a sheet is turning. Navigation is blocked meanwhile. |
| `currentSpread()`, `totalSpreads()`, `leftPage()`, `rightPage()` | Signals / functions with the current position (0-based page indexes). |

### CSS variables

| Variable | Default | Description |
| --- | --- | --- |
| `--ngx-magazine-max-width` | `900px` | Maximum width. |
| `--ngx-magazine-background` | `#e8e3dc` | Background behind the pages. |
| `--ngx-magazine-paper` | `white` | Page background color. |
| `--ngx-magazine-radius` | `3px` | Outer corner radius of the pages. |
| `--ngx-magazine-page-shadow` | soft shadow | `box-shadow` of static pages. |
| `--ngx-magazine-face-shadow` | soft shadow | `box-shadow` of the turning sheet. |
| `--ngx-magazine-overflow` | `hidden` | `overflow` of the container. |
| `--ngx-magazine-controls-space` | `56px` | Space reserved under the book for the controls. |

## A collection of magazines

```html
<ngx-magazine-collection
  label="My magazines"
  (magazineSelect)="onSelect($event)"
  (magazineOpen)="onOpen($event)"
  (magazineClose)="onClose($event)"
>
  <ngx-magazine-item id="travel" label="Travel" spineColor="#2f7f8f" burstText="New!">
    <ngx-magazine>
      <ng-template ngxMagazinePage>…cover…</ng-template>
      <ng-template ngxMagazinePage>…page 2…</ng-template>
    </ngx-magazine>
  </ngx-magazine-item>
</ngx-magazine-collection>
```

The cover on the table is page 0 of the inner `<ngx-magazine>`: you define it only once. Clicking (or Enter / Space on) a cover opens the magazine in a modal over a darkened page. The magazine starts closed and centered; the user opens it with › or by clicking the cover. Close with ×, Escape or clicking outside.

### `NgxMagazineCollection`

| Input | Default | Description |
| --- | --- | --- |
| `columns` | auto (2, or 3 from 720px) | Number of columns. |
| `tilt` | `24` | Rotation of each magazine, in degrees. |
| `gap` | `3rem` | Horizontal gap. |
| `rowGap` | `4.5rem` | Vertical gap between rows. |
| `label` | `Magazine collection` | Accessible name. |

| Output | When |
| --- | --- |
| `magazineSelect` | A magazine is selected (modal starts to appear). |
| `magazineOpen` | The cover finished opening for the first time. |
| `magazineClose` | The magazine finished closing and the modal disappeared. |

Methods: `select(id)`, `close()`. Signals: `selectedId()`, `phase()` (`idle`, `entering`, `shown`, `opening`, `reading`, `closing`, `leaving`).

### `NgxMagazineItem`

| Input | Description |
| --- | --- |
| `id` (required) | Unique id inside the collection. |
| `label` | Accessible name (and default text of the comic burst). |
| `spineColor` | Color of the spine and back of the book on the table. |
| `burstText` | Text of the burst shown on hover. Omit to use `label`; `""` hides it. |

Extra CSS variables: `--ngx-magazine-thickness` (`12px`), `--ngx-magazine-perspective` (`none`), `--ngx-magazine-ink` (`#111`), `--ngx-magazine-pop` (`#ffd400`), `--ngx-magazine-burst-size` (`70%`), `--ngx-magazine-modal-shadow`, `--ngx-magazine-focus-ring` (`none`).

## Page content

The library does not style your content: it gives each page a box of the page size. A full-page image:

```html
<ng-template ngxMagazinePage>
  <img src="photo.jpg" alt="" style="width:100%;height:100%;object-fit:cover;display:block" />
</ng-template>
```

### Known limitations

- A page is re-created when it moves between the turning sheet and the static layer, so a `<video>` or form state inside a page resets on every flip.
- On the table, a cover is also instantiated inside the modal's magazine (only rendered once the modal opens).
- Closing a magazine always returns to the cover.

## License

MIT