import type { PageSummary } from './types';

const WIKIPEDIA_API = 'https://en.wikipedia.org/api/rest_v1';
const MEDIAWIKI_API = 'https://en.wikipedia.org/w/api.php';

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
  const searchResult = await searchWiki(query);
  if (searchResult) title = searchResult;

  const [summary, categories, fullExtract] = await Promise.all([
    getPageSummary(title),
    getPageCategories(title),
    getPageExtract(title),
  ]);

  if (fullExtract) summary.fullExtract = fullExtract;

  return { summary, categories };
}
