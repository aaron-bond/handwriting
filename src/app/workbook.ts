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
];
