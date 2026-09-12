import { Component, output } from '@angular/core';
import { WORKBOOKS, Workbook } from '../workbook';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly workbooks = WORKBOOKS;

  readonly selectWorkbook = output<Workbook>();
  readonly selectCustom = output<void>();

  itemLabel(workbook: Workbook): string {
    return workbook.items[0]?.kind === 'shape' ? 'shapes' : 'words';
  }

  icon(workbook: Workbook): string {
    return workbook.items[0]?.kind === 'shape' ? '🔷' : '📝';
  }
}
