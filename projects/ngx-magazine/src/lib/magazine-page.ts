import { Directive, TemplateRef, inject } from '@angular/core';

@Directive({
  selector: 'ng-template[ngxMagazinePage]',
  standalone: true,
})
export class MagazinePage {
  readonly template = inject(TemplateRef<unknown>);
}