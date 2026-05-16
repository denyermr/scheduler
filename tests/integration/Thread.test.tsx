import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import { Thread } from '../../src/ui/Thread';
import {
  THREAD_OPACITY,
  THREAD_STROKE,
  THREAD_WIDTH,
  threadSag,
} from '../../src/ui/tokens';

function pathFromContainer(container: HTMLElement): SVGPathElement {
  const path = container.querySelector('path');
  if (!path) throw new Error('No <path> found in container');
  return path as SVGPathElement;
}

describe('<Thread />', () => {
  it('renders an SVG path with the canonical stroke + width + opacity', () => {
    const { container } = render(
      <svg>
        <Thread x1={10} y1={20} x2={110} y2={120} />
      </svg>,
    );
    const path = pathFromContainer(container);
    expect(path.getAttribute('stroke')).toBe(THREAD_STROKE);
    expect(path.getAttribute('stroke-width')).toBe(String(THREAD_WIDTH));
    expect(path.getAttribute('stroke-linecap')).toBe('round');
    expect(path.getAttribute('opacity')).toBe(String(THREAD_OPACITY));
    expect(path.getAttribute('fill')).toBe('none');
  });

  it('builds a quadratic path with sag that grows with distance, clamped to 8..22', () => {
    const x1 = 0,
      y1 = 0,
      x2 = 300,
      y2 = 0;
    const { container } = render(
      <svg>
        <Thread x1={x1} y1={y1} x2={x2} y2={y2} />
      </svg>,
    );
    const d = pathFromContainer(container).getAttribute('d') ?? '';
    const sag = threadSag(300);
    expect(sag).toBe(18);
    expect(d).toBe(`M 0 0 Q 150 ${String(sag)} 300 0`);
  });

  it('uses the minimum sag of 8 for very short threads', () => {
    expect(threadSag(10)).toBe(8);
    const { container } = render(
      <svg>
        <Thread x1={0} y1={0} x2={10} y2={0} />
      </svg>,
    );
    const d = pathFromContainer(container).getAttribute('d') ?? '';
    expect(d).toContain('Q 5 8');
  });

  it('clamps the sag to 22 for very long threads', () => {
    expect(threadSag(1000)).toBe(22);
    const { container } = render(
      <svg>
        <Thread x1={0} y1={0} x2={1000} y2={0} />
      </svg>,
    );
    const d = pathFromContainer(container).getAttribute('d') ?? '';
    expect(d).toContain('Q 500 22');
  });
});
