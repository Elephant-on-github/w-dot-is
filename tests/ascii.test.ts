import { describe, expect, it } from 'bun:test';
import { getAsciiDimensions } from '../src/ascii';

describe('getAsciiDimensions', () => {
  it('returns dimensions proportional to terminal size', () => {
    const dims = getAsciiDimensions(80, 24);
    expect(dims.chars).toBe(64);
    expect(dims.lines).toBeGreaterThan(0);
  });

  it('scales with terminal width', () => {
    const dims = getAsciiDimensions(120, 30);
    expect(dims.chars).toBe(98);
  });

  it('handles small terminals', () => {
    const dims = getAsciiDimensions(40, 10);
    expect(dims.chars).toBe(30);
  });
});
