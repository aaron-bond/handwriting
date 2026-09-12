import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Practice } from './practice';

describe('Practice', () => {
  let component: Practice;
  let fixture: ComponentFixture<Practice>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [Practice],
    }).compileComponents();

    fixture = TestBed.createComponent(Practice);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('workbook', {
      id: 'test',
      title: 'Test',
      items: [{ kind: 'text', value: 'hello' }],
    });
    fixture.componentRef.setInput('cursive', false);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
