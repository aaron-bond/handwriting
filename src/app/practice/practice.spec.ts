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
      icon: '📝',
      itemLabel: 'words',
      color: { accent: '#4dabf7', accentDark: '#1c7ed6', accentSoft: '#d0ebff' },
      items: [{ kind: 'text', value: 'hello' }],
    });
    fixture.componentRef.setInput('cursive', false);
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
