import '@testing-library/jest-dom/vitest';
import { cleanup } from '@testing-library/react';
import { afterEach } from 'vitest';

// Vitest globals are off, so Testing Library does not clean up between tests on its own.
afterEach(() => cleanup());

// jsdom has no canvas and logs an error whenever getContext is called. Report "unsupported" quietly
// (components must cope with that anyway); tests that need a drawing context install their own.
if (typeof HTMLCanvasElement !== 'undefined') {
  HTMLCanvasElement.prototype.getContext = () => null;
}
