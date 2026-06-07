import type { PageSummary } from './types';

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';
const MEDIAWIKI_API = 'https://en.wikipedia.org/w/api.php';
const DATAMUSE_API = 'https://api.datamuse.com';

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: { 'User-Agent': 'w.is-cli/1.0' },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function searchWiki(query: string): Promise<string | null> {
  const url = `${MEDIAWIKI_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=1&format=json`;
  const data = await fetchJson<[string, string[], string[], string[]]>(url);
  const titles = data[1];
  return titles.length > 0 ? titles[0]! : null;
}

export async function searchWikiFullText(query: string): Promise<string | null> {
  const url = `${MEDIAWIKI_API}?action=query&list=search&srsearch=${encodeURIComponent(query)}&srwhat=text&format=json&srlimit=1`;
  const data = await fetchJson<{
    query: { search: { title: string }[] };
  }>(url);
  const results = data.query.search;
  return results.length > 0 ? results[0]!.title : null;
}

export async function searchByDatamuse(description: string): Promise<string | null> {
  const url = `${DATAMUSE_API}/words?ml=${encodeURIComponent(description)}&max=5`;
  const data = await fetchJson<{ word: string; score: number }[]>(url);
  for (const { word } of data) {
    const found = await searchWiki(word);
    if (found) return found;
  }
  return null;
}

export async function getPageSummary(title: string): Promise<PageSummary> {
  const url = `${WIKIPEDIA_API}/page/summary/${encodeURIComponent(title)}`;
  return fetchJson<PageSummary>(url);
}

export async function getPageCategories(title: string): Promise<string[]> {
  const url = `${MEDIAWIKI_API}?action=query&prop=categories&titles=${encodeURIComponent(title)}&format=json&pllimit=50`;
  const data = await fetchJson<{
    query: { pages: Record<string, { categories?: { title: string }[] }> };
  }>(url);
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  if (!page?.categories) return [];
  return page.categories.map((c) => c.title.replace(/^Category:/, ''));
}

export async function getPageExtract(title: string): Promise<string | null> {
  const url = `${MEDIAWIKI_API}?action=query&prop=extracts&titles=${encodeURIComponent(title)}&format=json&explaintext=1`;
  const data = await fetchJson<{
    query: { pages: Record<string, { extract?: string }> };
  }>(url);
  const pages = data.query.pages;
  const page = Object.values(pages)[0];
  return page?.extract || null;
}

export async function resolveEntity(query: string): Promise<{
  summary: PageSummary;
  categories: string[];
}> {
  let title = query;
  let searchResult = await searchWiki(query);
  if (!searchResult) searchResult = await searchByDatamuse(query);
  if (!searchResult) searchResult = await searchWikiFullText(query);
  if (searchResult) title = searchResult;

  const [summary, categories, fullExtract] = await Promise.all([
    getPageSummary(title),
    getPageCategories(title),
    getPageExtract(title),
  ]);

  if (fullExtract) summary.fullExtract = fullExtract;

  return { summary, categories };
}
