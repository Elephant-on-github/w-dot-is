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

const STOP_WORDS = new Set([
  'a',
  'an',
  'the',
  'for',
  'of',
  'in',
  'on',
  'at',
  'to',
  'with',
  'and',
  'or',
  'is',
  'are',
  'was',
  'were',
  'be',
  'been',
  'being',
  'have',
  'has',
  'had',
  'do',
  'does',
  'did',
  'but',
  'not',
  'so',
  'by',
  'from',
  'about',
  'into',
  'through',
  'during',
  'before',
  'after',
  'above',
  'below',
  'between',
  'out',
  'off',
  'over',
  'under',
  'again',
  'further',
  'then',
  'once',
  'here',
  'there',
  'when',
  'where',
  'why',
  'how',
  'all',
  'each',
  'every',
  'both',
  'few',
  'more',
  'most',
  'other',
  'some',
  'such',
  'no',
  'nor',
  'only',
  'own',
  'same',
  'too',
  'very',
  'just',
  'because',
  'as',
  'until',
  'while',
  'that',
  'this',
  'these',
  'those',
  'it',
  'its',
  'also',
  'can',
  'its',
  'them',
  'their',
  'they',
  'what',
  'which',
  'who',
  'whom',
  'any',
  'one',
  'two',
  'new',
  'used',
  'use',
  'using',
]);

function tokenizeQuery(query: string): string[] {
  return query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((w) => w.length > 2 && !STOP_WORDS.has(w));
}

function scoreText(text: string, tokens: string[]): number {
  const lower = text.toLowerCase();
  let score = 0;
  for (const token of tokens) {
    const regex = new RegExp(`\\b${token}\\w*\\b`, 'gi');
    const matches = lower.match(regex);
    if (matches) score += matches.length;
  }
  return score;
}

function parseDisambigExtract(extract: string): { title: string; description: string }[] {
  const lines = extract
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const entries: { title: string; description: string }[] = [];
  for (const line of lines) {
    if (line.includes('may refer to:')) continue;
    const commaIndex = line.indexOf(',');
    if (commaIndex === -1) continue;
    entries.push({
      title: line.slice(0, commaIndex).trim(),
      description: line.slice(commaIndex + 1).trim(),
    });
  }
  return entries;
}

export async function resolveDisambiguation(
  query: string,
  summary: PageSummary,
): Promise<{ summary: PageSummary; categories: string[] } | null> {
  const entries = parseDisambigExtract(summary.extract || '');
  if (entries.length === 0) return null;

  const tokens = tokenizeQuery(query);
  if (tokens.length === 0) return null;

  let bestEntry: { title: string; description: string } | null = null;
  let bestScore = 0;

  for (const entry of entries) {
    const score = scoreText(`${entry.title} ${entry.description}`, tokens);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }

  if (!bestEntry || bestScore === 0) return null;

  const resolvedTitle = await searchWiki(bestEntry.title);
  if (!resolvedTitle) return null;

  const [newSummary, newCategories, newFullExtract] = await Promise.all([
    getPageSummary(resolvedTitle),
    getPageCategories(resolvedTitle),
    getPageExtract(resolvedTitle),
  ]);

  if (newFullExtract) newSummary.fullExtract = newFullExtract;

  return { summary: newSummary, categories: newCategories };
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

  let [summary, categories, fullExtract] = await Promise.all([
    getPageSummary(title),
    getPageCategories(title),
    getPageExtract(title),
  ]);

  if (fullExtract) summary.fullExtract = fullExtract;

  if (summary.type === 'disambiguation') {
    const resolved = await resolveDisambiguation(query, summary);
    if (resolved) {
      summary = resolved.summary;
      categories = resolved.categories;
    }
  }

  return { summary, categories };
}
