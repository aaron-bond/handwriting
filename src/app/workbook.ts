import { ShapeKind } from './trace-line/trace-line';

export type PracticeItem = { kind: 'text'; value: string } | { kind: 'shape'; value: ShapeKind };

export interface Workbook {
  id: string;
  title: string;
  icon: string;
  itemLabel: string; // plural, e.g. "words" - shown on the home tile and (singularized) in the progress line
  items: PracticeItem[];
}

function words(values: string[]): PracticeItem[] {
  return values.map((value) => ({ kind: 'text', value }));
}

function shapes(values: ShapeKind[]): PracticeItem[] {
  return values.map((value) => ({ kind: 'shape', value }));
}

const ALPHABET = 'abcdefghijklmnopqrstuvwxyz';

export const WORKBOOKS: Workbook[] = [
  {
    id: 'everyday-words',
    title: 'Everyday Words',
    icon: '📝',
    itemLabel: 'words',
    items: words(['red', 'blue', 'green', 'yellow', 'purple', 'chair', 'table', 'spoon', 'book', 'lamp']),
  },
  {
    id: 'shapes',
    title: 'Shapes',
    icon: '🔷',
    itemLabel: 'shapes',
    items: shapes(['circle', 'square', 'triangle', 'rectangle', 'star']),
  },
  {
    id: 'alphabet',
    title: 'Alphabet',
    icon: '🔤',
    itemLabel: 'letters',
    // Upper/lowercase pairs (Aa, Bb, Cc, ...) rather than one bare letter
    // at a time, so each practice item shows how the two forms relate.
    items: words([...ALPHABET].map((letter) => letter.toUpperCase() + letter)),
  },
  {
    id: 'maths',
    title: 'Maths',
    icon: '🔢',
    itemLabel: 'sums',
    // Spaced out ("1 + 1 = 2" rather than "1+1=2") so each symbol has
    // room to be traced on its own without crowding its neighbours.
    items: words([
      '1 + 1 = 2',
      '2 + 1 = 3',
      '1 + 2 = 3',
      '2 + 2 = 4',
      '3 + 1 = 4',
      '5 - 2 = 3',
      '4 - 1 = 3',
      '3 - 1 = 2',
      '2 - 1 = 1',
      '1 - 1 = 0',
    ]),
  },
];
