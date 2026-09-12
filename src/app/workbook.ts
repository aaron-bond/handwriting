import { ShapeKind } from './trace-line/trace-line';

export type PracticeItem = { kind: 'text'; value: string } | { kind: 'shape'; value: ShapeKind };

export interface Workbook {
  id: string;
  title: string;
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
    items: words(['red', 'blue', 'green', 'yellow', 'purple', 'chair', 'table', 'spoon', 'book', 'lamp']),
  },
  {
    id: 'shapes',
    title: 'Shapes',
    items: shapes(['circle', 'square', 'triangle', 'rectangle', 'star']),
  },
  {
    id: 'alphabet',
    title: 'Alphabet',
    // Upper/lowercase pairs (Aa, Bb, Cc, ...) rather than one bare letter
    // at a time, so each practice item shows how the two forms relate.
    items: words([...ALPHABET].map((letter) => letter.toUpperCase() + letter)),
  },
];
