import { Component, computed, signal } from '@angular/core';
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
  tagline: string;
  issue: number;
  c1: string;
  c2: string;
  headline: string;
  intro: string;
  quote: string;
  items: string[];
}

interface Feature {
  title: string;
  text: string;
}

/** Replace with your real repository URL. */
const REPO_URL = 'https://github.com/JoseM97/ngx-magazine';
const NPM_URL = 'https://www.npmjs.com/package/ngx-magazine';

const USAGE = `import { MagazinePage, NgxMagazineCollection, NgxMagazineItem, NgxMagazine } from 'ngx-magazine';

<ngx-magazine-collection (magazineSelect)="onSelect($event)">
  <ngx-magazine-item id="travel" label="Travel" spineColor="#2f7f8f">
    <ngx-magazine>
      <ng-template ngxMagazinePage>…cover…</ng-template>
      <ng-template ngxMagazinePage>…page 2…</ng-template>
      <ng-template ngxMagazinePage>…page 3…</ng-template>
    </ngx-magazine>
  </ngx-magazine-item>
</ngx-magazine-collection>`;

@Component({
  selector: 'app-root',
  imports: [NgxMagazine, MagazinePage, NgxMagazineCollection, NgxMagazineItem],
  templateUrl: './app.html',
  styleUrl: './app.css',
})
export class App {
  readonly repoUrl = REPO_URL;
  readonly npmUrl = NPM_URL;
  readonly usage = USAGE;

  readonly copied = signal(false);
  readonly lastEvent = signal<MagazinePageChangeEvent | null>(null);
  readonly lastEventText = computed(() => {
    const event = this.lastEvent();
    return event
      ? JSON.stringify(event)
      : 'Open the magazine and turn a page to see the pageChange event.';
  });

  readonly features: Feature[] = [
    {
      title: 'Realistic 3D flip',
      text: 'The cover and sheets turn with perspective, spine shadow and shading as they pass.',
    },
    {
      title: 'A collection on the table',
      text: 'Magazines with thickness, a comic-style hover and a modal to read them.',
    },
    {
      title: 'Free-form content',
      text: 'Each page is an ng-template: text, images, video or Angular components.',
    },
    {
      title: 'Keyboard & accessibility',
      text: 'Arrow keys, Escape, managed focus, ARIA roles and prefers-reduced-motion support.',
    },
    {
      title: 'Responsive',
      text: 'Fluid columns and sizes, 44px touch targets and a modal that fits the viewport.',
    },
    {
      title: 'Zero dependencies',
      text: 'Standalone, signals and plain CSS: no animation or third-party libraries.',
    },
  ];

  readonly magazines: DemoMagazine[] = [
    {
      id: 'fashion',
      title: 'Fashion',
      tagline: 'Trends, fabrics and workshops',
      issue: 12,
      c1: '#b5446e',
      c2: '#e07a9a',
      headline: 'Sewing comes home',
      intro: 'Small workshops are reviving classic patterns and mixing them with recycled fabrics.',
      quote: 'Handmade never goes out of style.',
      items: ['Five coats for autumn', 'A guide to recycled fabrics', 'The neighbourhood tailor'],
    },
    {
      id: 'travel',
      title: 'Travel',
      tagline: 'Slow routes along coasts and mountains',
      issue: 48,
      c1: '#2f7f8f',
      c2: '#5bb5a2',
      headline: 'Ten villages, no rush',
      intro: 'Itineraries to explore the north by train, with long stops and hearty stews.',
      quote: 'The best map is the one that folds badly.',
      items: ['Train along the coast', 'Mountain huts with views', 'Dawn markets'],
    },
    {
      id: 'food',
      title: 'Food',
      tagline: 'Seasonal recipes',
      issue: 31,
      c1: '#c9772c',
      c2: '#e8a94a',
      headline: 'Pumpkin three ways',
      intro: 'Roasted, as a soup and in a cake: one vegetable, three dishes and almost no waste.',
      quote: 'Cooking is a way of paying attention.',
      items: ['Ginger soup', 'Spiced cake', 'Toasted seeds'],
    },
    {
      id: 'science',
      title: 'Science',
      tagline: 'Small questions, big answers',
      issue: 7,
      c1: '#3d5a9e',
      c2: '#6a8fdc',
      headline: 'Why the sea glows',
      intro: 'Bioluminescence is a language of light that thousands of species use to survive.',
      quote: 'Understanding something does not take away the wonder.',
      items: ['Glowing plankton', 'Auroras explained', 'The sound of ice'],
    },
    {
      id: 'art',
      title: 'Art',
      tagline: 'Galleries, studios and archives',
      issue: 22,
      c1: '#7a4a9a',
      c2: '#b27bd0',
      headline: 'Colour after colour',
      intro: 'A generation of painters is returning to natural pigments and slower timelines.',
      quote: 'Looking slowly is also a craft.',
      items: ['Earth pigments', 'Contemporary printmaking', 'Three open studios'],
    },
    {
      id: 'sport',
      title: 'Sport',
      tagline: 'Train, run, enjoy',
      issue: 15,
      c1: '#3f8f4f',
      c2: '#7cc47f',
      headline: 'Running without a watch',
      intro: 'Heading out without measuring anything: less data, more feeling and better consistency.',
      quote: 'Pace is found, not imposed.',
      items: ['Routes along the river', 'Twenty-minute strength', 'Sleep as training'],
    },
    {
      id: 'tech',
      title: 'Tech',
      tagline: 'Tools that last',
      issue: 63,
      c1: '#444c5c',
      c2: '#7b8499',
      headline: 'Software that lasts',
      intro: 'Choosing small, open and documented tools is the best long-term investment.',
      quote: 'What is simple is what can be maintained.',
      items: ['Open formats', 'Backups', 'Fewer apps'],
    },
    {
      id: 'garden',
      title: 'Garden',
      tagline: 'Balconies, allotments and pots',
      issue: 9,
      c1: '#6b8f2f',
      c2: '#a3c455',
      headline: 'A vegetable patch on the balcony',
      intro: 'With four pots and good light you can harvest herbs and tomatoes for months.',
      quote: 'Every garden starts with a single pot.',
      items: ['Herbs to start with', 'Watering without waste', 'Autumn bulbs'],
    },
    {
      id: 'cinema',
      title: 'Cinema',
      tagline: 'Premieres, seasons and rarities',
      issue: 40,
      c1: '#a33a3a',
      c2: '#d4645a',
      headline: 'Theatres that resist',
      intro: 'Neighbourhood cinemas are programming seasons, talks and double bills to win audiences back.',
      quote: 'A film is better when watched together.',
      items: ['Silent film season', 'Rarities on 16mm', 'Directors to follow'],
    },
  ];

  onSelect(event: MagazineCollectionEvent): void {
    console.log('Magazine selected:', event);
  }

  onOpen(event: MagazineCollectionEvent): void {
    console.log('Magazine opened:', event);
  }

  onClose(event: MagazineCollectionEvent): void {
    console.log('Magazine closed:', event);
  }

  onPageChange(event: MagazinePageChangeEvent): void {
    this.lastEvent.set(event);
  }

  async copyInstall(): Promise<void> {
    try {
      await navigator.clipboard.writeText('npm install ngx-magazine');
      this.copied.set(true);
      setTimeout(() => this.copied.set(false), 1800);
    } catch {
      this.copied.set(false);
    }
  }
}