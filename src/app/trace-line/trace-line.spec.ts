import { ComponentFixture, TestBed } from '@angular/core/testing';
import { TraceLine } from './trace-line';

describe('TraceLine', () => {
  let component: TraceLine;
  let fixture: ComponentFixture<TraceLine>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [TraceLine],
    }).compileComponents();

    fixture = TestBed.createComponent(TraceLine);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('text', 'hello');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
