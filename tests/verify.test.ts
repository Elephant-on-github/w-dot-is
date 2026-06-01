import { describe, expect, it } from 'bun:test';
import { verifyClaim } from '../src/verify';

describe('verifyClaim', () => {
  it('returns true for "banana is a fruit"', async () => {
    const result = await verifyClaim('banana', 'fruit');
    expect(result.result).toBe(true);
  }, 10000);

  it('returns false for "banana is a vegetable"', async () => {
    const result = await verifyClaim('banana', 'vegetable');
    expect(result.result).toBe(false);
  }, 10000);

  it('returns true for "Saturn is a planet"', async () => {
    const result = await verifyClaim('Saturn', 'planet');
    expect(result.result).toBe(true);
  }, 10000);
});
