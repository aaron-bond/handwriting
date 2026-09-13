import { ComponentFixture, TestBed } from '@angular/core/testing';
import { PictureFill } from './picture-fill';

describe('PictureFill', () => {
  let component: PictureFill;
  let fixture: ComponentFixture<PictureFill>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [PictureFill],
    }).compileComponents();

    fixture = TestBed.createComponent(PictureFill);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('picture', 'balloon');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
