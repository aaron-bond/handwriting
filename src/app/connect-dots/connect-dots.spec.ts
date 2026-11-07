import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConnectDots, distanceToSegment, dotLabel, labelDirection } from './connect-dots';

describe('ConnectDots', () => {
  let component: ConnectDots;
  let fixture: ComponentFixture<ConnectDots>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ConnectDots],
    }).compileComponents();

    fixture = TestBed.createComponent(ConnectDots);
    component = fixture.componentInstance;
    fixture.componentRef.setInput('picture', 'star');
    await fixture.whenStable();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
    expect(component.canUndo()).toBe(false);
    expect(component.result()).toBeNull();
  });
});

describe('dotLabel', () => {
  it('numbers from 1 and letters from A', () => {
    expect(dotLabel(0, 'numbers')).toBe('1');
    expect(dotLabel(11, 'numbers')).toBe('12');
    expect(dotLabel(0, 'letters')).toBe('A');
    expect(dotLabel(25, 'letters')).toBe('Z');
  });
});

describe('distanceToSegment', () => {
  it('measures to the nearest point on the segment, not just its ends', () => {
    // A fast stroke from (0,0) to (100,0) passes right over a dot at (50,5).
    expect(distanceToSegment(50, 5, 0, 0, 100, 0)).toBeCloseTo(5);
    // Beyond the end, it's the distance to the endpoint.
    expect(distanceToSegment(103, 4, 0, 0, 100, 0)).toBeCloseTo(5);
    // A zero-length segment (a tap) is just point distance.
    expect(distanceToSegment(3, 4, 0, 0, 0, 0)).toBeCloseTo(5);
  });
});

describe('labelDirection', () => {
  it('points away from both neighbouring lines', () => {
    // A right-angle corner with neighbours to the right and below -> up-left.
    const [dx, dy] = labelDirection([10, 0], [0, 0], [0, 10]);
    expect(dx).toBeLessThan(0);
    expect(dy).toBeLessThan(0);
    expect(Math.hypot(dx, dy)).toBeCloseTo(1);
  });

  it('uses a perpendicular for a straight-through dot', () => {
    const [dx, dy] = labelDirection([-10, 0], [0, 0], [10, 0]);
    expect(Math.abs(dx)).toBeCloseTo(0);
    expect(Math.abs(dy)).toBeCloseTo(1);
  });
});
