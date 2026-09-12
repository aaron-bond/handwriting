import { ShapeKind } from './trace-line/trace-line';

export type PracticeItem = { kind: 'text'; value: string } | { kind: 'shape'; value: ShapeKind };

// A workbook's colour theme, bound as CSS custom properties (--accent/
// --accent-dark/--accent-soft) on that workbook's tile/screen so one set
// of CSS rules can render every workbook in its own colour.
export interface WorkbookColor {
  accent: string;
  accentDark: string;
  accentSoft: string;
}

export interface Workbook {
  id: string;
  title: string;
  icon: string;
  itemLabel: string; // plural, e.g. "words" - shown on the home tile and (singularized) in the progress line
  color: WorkbookColor;
  items: PracticeItem[];
}

// The "Custom Word" screen isn't a real Workbook (free text, not a fixed
// item list), but shares the same tile/colour treatment on Home.
export const CUSTOM_COLOR: WorkbookColor = {
  accent: '#f783ac',
  accentDark: '#d6336c',
  accentSoft: '#ffdeeb',
};

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
    color: { accent: '#4dabf7', accentDark: '#1c7ed6', accentSoft: '#d0ebff' },
    items: words(['red', 'blue', 'green', 'yellow', 'purple', 'chair', 'table', 'spoon', 'book', 'lamp']),
  },
  {
    id: 'shapes',
    title: 'Shapes',
    icon: '🔷',
    itemLabel: 'shapes',
    color: { accent: '#9775fa', accentDark: '#7048e8', accentSoft: '#e5dbff' },
    items: shapes(['circle', 'square', 'triangle', 'rectangle', 'star']),
  },
  {
    id: 'alphabet',
    title: 'Alphabet',
    icon: '🔤',
    itemLabel: 'letters',
    color: { accent: '#51cf66', accentDark: '#2f9e44', accentSoft: '#d3f9d8' },
    // Upper/lowercase pairs (Aa, Bb, Cc, ...) rather than one bare letter
    // at a time, so each practice item shows how the two forms relate.
    items: words([...ALPHABET].map((letter) => letter.toUpperCase() + letter)),
  },
  {
    id: 'maths',
    title: 'Maths',
    icon: '🔢',
    itemLabel: 'sums',
    color: { accent: '#ff922b', accentDark: '#e8590c', accentSoft: '#ffe8cc' },
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
