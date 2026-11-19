import { render } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ThemeProvider } from '../../lib/theme.tsx';
import { CoreCanvas, type FireflyCoreProps } from './CoreCanvas.tsx';

function fakeContext() {
  const gradient = { addColorStop: vi.fn() };
  return {
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    lineCap: 'butt',
    globalCompositeOperation: 'source-over',
    setTransform: vi.fn(),
    clearRect: vi.fn(),
    beginPath: vi.fn(),
    arc: vi.fn(),
    ellipse: vi.fn(),
    moveTo: vi.fn(),
    bezierCurveTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    createRadialGradient: vi.fn(() => gradient),
    createLinearGradient: vi.fn(() => gradient),
  };
}

function renderCore(props: FireflyCoreProps = {}) {
  return render(
    <ThemeProvider>
      <CoreCanvas {...props} />
    </ThemeProvider>,
  );
}

describe('CoreCanvas', () => {
  let raf: ReturnType<typeof vi.fn>;
  let cancel: ReturnType<typeof vi.fn>;
  let ctx: ReturnType<typeof fakeContext>;

  beforeEach(() => {
    localStorage.clear();
    ctx = fakeContext();
    raf = vi.fn(() => 7);
    cancel = vi.fn();
    vi.stubGlobal('requestAnimationFrame', raf);
    vi.stubGlobal('cancelAnimationFrame', cancel);
    // The element has no layout in jsdom, so give it a size.
    vi.spyOn(HTMLElement.prototype, 'clientWidth', 'get').mockReturnValue(240);
    vi.spyOn(HTMLElement.prototype, 'clientHeight', 'get').mockReturnValue(240);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('stays quiet and decorative when canvas is not available', () => {
    const { container } = renderCore();
    const core = container.querySelector('.core');
    expect(core).toHaveAttribute('aria-hidden', 'true');
    expect(core).not.toHaveAttribute('data-canvas');
    expect(raf).not.toHaveBeenCalled();
  });

  it('is announced as an image only when it is given a label', () => {
    const { getByRole } = renderCore({ label: 'Customer presence' });
    expect(getByRole('img', { name: 'Customer presence' })).toBeInTheDocument();
  });

  it('animates, and stops completely when it unmounts', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    const { container, unmount } = renderCore({
      mood: 'frustrated',
      signals: { total: 3, lit: 1 },
    });
    expect(container.querySelector('.core')).toHaveAttribute('data-canvas', 'on');
    expect(raf).toHaveBeenCalled();

    const tick = raf.mock.calls[0]?.[0] as (now: number) => void;
    tick(0);
    expect(ctx.clearRect).toHaveBeenCalled();

    unmount();
    expect(cancel).toHaveBeenCalled();
  });

  it('draws one still frame and never loops under reduced motion', () => {
    localStorage.setItem('firefly.motion', JSON.stringify('reduce'));
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    renderCore({ signals: { total: 2, lit: 0 } });
    expect(raf).not.toHaveBeenCalled();
    expect(ctx.clearRect).toHaveBeenCalled();
  });

  it('does not loop while paused', () => {
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(
      ctx as unknown as CanvasRenderingContext2D,
    );
    renderCore({ paused: true });
    expect(raf).not.toHaveBeenCalled();
  });
});
