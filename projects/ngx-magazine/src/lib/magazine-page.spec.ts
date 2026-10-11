import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { MagazinePage } from './magazine-page';

@Component({
  standalone: true,
  imports: [MagazinePage],
  template: `
    <ng-template ngxMagazinePage>
      <h1>Test page</h1>
    </ng-template>
  `,
})
class TestHost {}

describe('MagazinePage', () => {
  it('should create', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should register a page template', async () => {
    const fixture = TestBed.createComponent(TestHost);
    await fixture.whenStable();

    const pages = fixture.debugElement.injector;

    expect(fixture.nativeElement).toBeTruthy();
  });
});