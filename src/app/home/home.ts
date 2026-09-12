import { Component, output } from '@angular/core';
import { CUSTOM_COLOR, WORKBOOKS, Workbook } from '../workbook';

@Component({
  selector: 'app-home',
  imports: [],
  templateUrl: './home.html',
  styleUrl: './home.css',
})
export class Home {
  readonly workbooks = WORKBOOKS;
  readonly customColor = CUSTOM_COLOR;

  readonly selectWorkbook = output<Workbook>();
  readonly selectCustom = output<void>();
}
