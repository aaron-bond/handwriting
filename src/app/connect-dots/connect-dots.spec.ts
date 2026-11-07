import { ComponentFixture, TestBed } from '@angular/core/testing';
import { ConnectDots, StrokeProgress, advanceStroke, distanceToSegment, dotLabel, labelDirection } from './connect-dots';

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

describe('advanceStroke', () => {
  // Three dots 100px apart in a row.
  const points: [number, number][] = [
    [0, 0],
    [100, 0],
    [200, 0],
  ];
  const fresh: StrokeProgress = { reached: 0, anchored: false, travel: 0 };
  const penDown = (reached: number, at: [number, number]) =>
    advanceStroke({ reached, anchored: false, travel: 0 }, points, at, at);

  it('starts the picture when the pen goes down on dot 1', () => {
    expect(penDown(0, [0, 0]).reached).toBe(1);
  });

  it('ignores a tap straight onto the next dot', () => {
    // The reported cheat: tapping 1, 2, 3 in order.
    let reached = penDown(0, [0, 0]).reached;
    reached = penDown(reached, [100, 0]).reached;
    reached = penDown(reached, [200, 0]).reached;
    expect(reached).toBe(1);
  });

  it('reaches the next dot when a line is drawn to it from the previous one', () => {
    let progress = penDown(0, [0, 0]);
    progress = advanceStroke(progress, points, [0, 0], [50, 3]);
    expect(progress.reached).toBe(1);
    progress = advanceStroke(progress, points, [50, 3], [98, 2]);
    expect(progress.reached).toBe(2);
  });

  it('a stroke that starts away from the previous dot counts for nothing', () => {
    // Dot 1 joined; a new stroke starts halfway and runs onto dot 2.
    let progress = advanceStroke({ reached: 1, anchored: false, travel: 0 }, points, [50, 0], [50, 0]);
    progress = advanceStroke(progress, points, [50, 0], [100, 0]);
    expect(progress.reached).toBe(1);
  });

  it('a new stroke may restart from the last joined dot', () => {
    let progress = penDown(1, [2, 2]);
    expect(progress.anchored).toBe(true);
    progress = advanceStroke(progress, points, [2, 2], [100, 0]);
    expect(progress.reached).toBe(2);
  });

  it('needs real pen travel, even for close dots both within reach of one tap', () => {
    const close: [number, number][] = [
      [0, 0],
      [30, 0],
    ];
    let progress = advanceStroke({ ...fresh, reached: 1 }, close, [15, 0], [15, 0]);
    expect(progress.reached).toBe(1);
    // ...but actually drawing from one to the other works.
    progress = advanceStroke({ ...fresh, reached: 1 }, close, [0, 0], [0, 0]);
    progress = advanceStroke(progress, close, [0, 0], [30, 0]);
    expect(progress.reached).toBe(2);
  });

  it('one long fast segment can join several dots in a row', () => {
    let progress = penDown(0, [0, 0]);
    progress = advanceStroke(progress, points, [0, 0], [200, 0]);
    expect(progress.reached).toBe(3);
  });
});
