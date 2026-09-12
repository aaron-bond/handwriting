export interface Workbook {
  id: string;
  title: string;
  words: string[];
}

export const WORKBOOKS: Workbook[] = [
  {
    id: 'everyday-words',
    title: 'Everyday Words',
    words: ['red', 'blue', 'green', 'yellow', 'purple', 'chair', 'table', 'spoon', 'book', 'lamp'],
  },
];
