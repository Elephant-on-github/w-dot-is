import { describe, expect, it } from 'bun:test';
import { getPageCategories, getPageSummary, resolveEntity, searchWiki } from '../../src/wikipedia';

describe('searchWiki', () => {
  it('finds a page for banana', async () => {
    const result = await searchWiki('banana');
    expect(result).toBeString();
    expect(result?.toLowerCase()).toContain('banana');
  }, 10000);

  it('returns null for nonsense query', async () => {
    const result = await searchWiki('zxkjqwhdflkajsdf');
    expect(result).toBeNull();
  }, 10000);
});

describe('getPageSummary', () => {
  it('returns summary for banana', async () => {
    const result = await getPageSummary('Banana');
    expect(result.title).toBe('Banana');
    expect(result.extract.length).toBeGreaterThan(0);
  }, 10000);
});

describe('getPageCategories', () => {
  it('returns categories for banana', async () => {
    const result = await getPageCategories('Banana');
    expect(result.length).toBeGreaterThan(0);
    expect(result.some((c: string) => c.toLowerCase().includes('bananas'))).toBe(true);
  }, 10000);
});

describe('resolveEntity', () => {
  it('resolves a query to summary and categories', async () => {
    const result = await resolveEntity('banana');
    expect(result.summary.title).toBe('Banana');
    expect(result.categories.length).toBeGreaterThan(0);
  }, 10000);
});
