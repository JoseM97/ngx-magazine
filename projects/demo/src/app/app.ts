import { Component } from '@angular/core';
import {
  MagazineCollectionEvent,
  MagazinePage,
  MagazinePageChangeEvent,
  NgxMagazine,
  NgxMagazineCollection,
  NgxMagazineItem,
} from 'ngx-magazine';

interface DemoMagazine {
  id: string;
  title: string;
  color: string;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [
    NgxMagazine,
    MagazinePage,
    NgxMagazineCollection,
    NgxMagazineItem,
  ],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly magazines: DemoMagazine[] = [
    { id: 'moda', title: 'Moda', color: '#b5446e' },
    { id: 'viajes', title: 'Viajes', color: '#2f7f8f' },
    { id: 'cocina', title: 'Cocina', color: '#c9772c' },
    { id: 'ciencia', title: 'Ciencia', color: '#3d5a9e' },
    { id: 'arte', title: 'Arte', color: '#7a4a9a' },
    { id: 'deporte', title: 'Deporte', color: '#3f8f4f' },
    { id: 'tecnologia', title: 'Tecnología', color: '#444c5c' },
    { id: 'jardin', title: 'Jardín', color: '#6b8f2f' },
    { id: 'cine', title: 'Cine', color: '#a33a3a' },
  ];

  readonly interiorPages = [2, 3, 4, 5];

  onPageChange(event: MagazinePageChangeEvent): void {
    console.log('Cambio de página:', event);
  }

  onSelect(event: MagazineCollectionEvent): void {
    console.log('Revista seleccionada:', event);
  }

  onClose(event: MagazineCollectionEvent): void {
    console.log('Revista cerrada:', event);
  }
}