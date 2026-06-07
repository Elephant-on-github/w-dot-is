import type { PageSummary } from './types';

const API = 'https://en.wikipedia.org/api/rest_v1';
const MEDIAWIKI_API = 'https://en.wikipedia.org/w/api.php';
const DATAMUSE_API = 'https://api.datamuse.com';
const UA = 'w.is-cli/1.0 (https://github.com/Elephant-on-github/w.is)';

async function fetchWithRetry(url: string, retries = 3): Promise<Response> {
  for (let i = 0; i < retries; i++) {
    const res = await fetch(url, { headers: { 'User-Agent': UA } });
    if (res.status !== 429) return res;
    if (i < retries - 1) {
      await new Promise((r) => setTimeout(r, (i + 1) * 1000));
    }
  }
  return fetch(url, { headers: { 'User-Agent': UA } });
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetchWithRetry(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);
  return res.json() as Promise<T>;
}

export async function searchWiki(query: string, limit = 1): Promise<string[]> {
  const url = `${MEDIAWIKI_API}?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json`;
  const data = await fetchJson<[string, string[], string[], string[]]>(url);
  return data[1];
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
  const tokens = tokenizeQuery(description);

  let bestTitle: string | null = null;
  let bestTokenMatches = -1;
  let firstTitle: string | null = null;

  for (const { word } of data) {
    const found = await searchWiki(word, 1);
    if (found.length > 0) {
      const title = found[0]!;
      if (firstTitle === null) firstTitle = title;

      const tokenMatches = tokens.filter((t) => title.toLowerCase().includes(t)).length;
      if (tokenMatches > bestTokenMatches) {
        bestTokenMatches = tokenMatches;
        bestTitle = title;
      }
    }
  }

  return bestTitle ?? firstTitle;
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

function primaryBonus(title: string, query: string): number {
  const lower = title.toLowerCase();
  const lowerQuery = query.toLowerCase();
  let bonus = 0;
  if (lower === lowerQuery) bonus += 20;
  else if (lower.startsWith(`${lowerQuery} `) || lower.startsWith(`${lowerQuery} (`)) bonus += 10;
  if (!lower.includes('(')) bonus += 5;
  return bonus;
}

function scoreEntry(title: string, description: string, tokens: string[], query: string): number {
  const lowerTitle = title.toLowerCase();
  const lowerDesc = description.toLowerCase();
  const combined = `${lowerTitle} ${lowerDesc}`;
  let score = primaryBonus(title, query);
  for (const token of tokens) {
    const regex = new RegExp(`\\b${token}\\w*\\b`, 'gi');
    const matches = combined.match(regex);
    if (matches) score += matches.length;
    if (lowerTitle.includes(token)) score += 3;
    if (lowerDesc.includes(token)) score += 1;
  }
  return score;
}

const ENTRY_RE = /^\s*(?:\*\s*)?(?:\[\[)?([^\]]+?)(?:\]\])?(?:\s*[,—–-]\s*(.*))?$/;

function parseDisambigExtract(extract: string): { title: string; description: string }[] {
  const lines = extract
    .trim()
    .split('\n')
    .filter((l) => l.trim());
  const entries: { title: string; description: string }[] = [];
  for (const line of lines) {
    if (line.includes('may refer to:')) continue;
    const m = line.match(ENTRY_RE);
    if (!m) continue;
    let title = m[1]?.trim();
    if (!title || title.startsWith('may refer to')) continue;
    title = title.replace(/\(disambiguation\)\s*$/i, '').trim();
    if (!title) continue;
    entries.push({ title, description: m[2]?.trim() ?? '' });
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
  if (tokens.length === 0) return fetchPageData(entries[0]!.title);
  let bestEntry = entries[0]!;
  let bestScore = 0;
  for (const entry of entries) {
    const score = scoreEntry(entry.title, entry.description, tokens, query);
    if (score > bestScore) {
      bestScore = score;
      bestEntry = entry;
    }
  }
  return fetchPageData(bestEntry.title);
}

async function fetchPageData(title: string): Promise<{
  summary: PageSummary;
  categories: string[];
}> {
  const [summary, categories, fullExtract] = await Promise.all([
    getPageSummary(title),
    getPageCategories(title),
    getPageExtract(title),
  ]);
  if (fullExtract) summary.fullExtract = fullExtract;
  return { summary, categories };
}

export async function getPageSummary(title: string): Promise<PageSummary> {
  const url = `${API}/page/summary/${encodeURIComponent(title)}`;
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

interface BatchPage {
  pageid: number;
  title: string;
  extract?: string;
  description?: string;
  categories?: { title: string }[];
  thumbnail?: { source: string; width: number; height: number };
  pageprops?: { disambiguation?: string };
}

interface Candidate {
  title: string;
  summary: PageSummary;
  categories: string[];
}

async function batchFetchPages(titles: string[]): Promise<Map<string, BatchPage>> {
  if (titles.length === 0) return new Map();
  const url =
    `${MEDIAWIKI_API}?action=query` +
    `&titles=${encodeURIComponent(titles.join('|'))}` +
    `&prop=extracts|categories|pageimages|pageprops|description` +
    `&redirects=1&pithumbsize=1000&explaintext=1&exintro=1&cllimit=50&format=json&formatversion=2`;
  const data = await fetchJson<{ query: { pages: BatchPage[] } }>(url);
  const map = new Map<string, BatchPage>();
  for (const page of data.query.pages) {
    map.set(page.title, page);
  }
  return map;
}

async function searchWithData(query: string, limit = 5): Promise<Map<string, BatchPage>> {
  const url =
    `${MEDIAWIKI_API}?action=query` +
    `&generator=search&gsrsearch=${encodeURIComponent(query)}` +
    `&gsrlimit=${limit}` +
    `&prop=extracts|categories|pageimages|pageprops|description` +
    `&pithumbsize=1000&explaintext=1&exintro=1&cllimit=50&format=json&formatversion=2`;
  const data = await fetchJson<{ query?: { pages: BatchPage[] } }>(url);
  const map = new Map<string, BatchPage>();
  if (data.query?.pages) {
    for (const page of data.query.pages) {
      map.set(page.title, page);
    }
  }
  return map;
}

function isDisambig(page: BatchPage): boolean {
  return page.pageprops?.disambiguation !== undefined;
}

function batchToCandidate(page: BatchPage): Candidate | null {
  const cats = (page.categories || []).map((c) => c.title.replace(/^Category:/, ''));
  return {
    title: page.title,
    summary: {
      title: page.title,
      type: isDisambig(page) ? 'disambiguation' : undefined,
      extract: page.extract || '',
      description: page.description,
      thumbnail: page.thumbnail,
      pageid: page.pageid,
      fullExtract: page.extract || undefined,
    },
    categories: cats,
  };
}

function sortCandidates(candidates: Candidate[], query: string): void {
  const queryTokens = tokenizeQuery(query);
  candidates.sort((a, b) => {
    const aLower = a.title.toLowerCase();
    const bLower = b.title.toLowerCase();
    let aTokenMatches = 0;
    let bTokenMatches = 0;
    for (const token of queryTokens) {
      if (aLower.includes(token)) aTokenMatches++;
      if (bLower.includes(token)) bTokenMatches++;
    }
    if (aTokenMatches !== bTokenMatches) return bTokenMatches - aTokenMatches;
    const bonusA = primaryBonus(a.title, query);
    const bonusB = primaryBonus(b.title, query);
    if (bonusA !== bonusB) return bonusB - bonusA;
    const aHasParen = a.title.includes('(');
    const bHasParen = b.title.includes('(');
    if (aHasParen !== bHasParen) return aHasParen ? 1 : -1;
    return 0;
  });
}

function bestTokenMatch(candidates: Candidate[], query: string): Candidate | null {
  if (candidates.length === 0) return null;
  sortCandidates(candidates, query);
  const best = candidates[0]!;
  const queryTokens = tokenizeQuery(query);
  if (queryTokens.length === 0) return best;
  const bestLower = best.title.toLowerCase();
  if (queryTokens.some((t) => bestLower.includes(t))) return best;
  return null;
}

const MAX_CANDIDATES = 5;

const QUERY_ALIASES: Record<string, string> = {
  usa: 'United States',
  uk: 'United Kingdom',
  uae: 'United Arab Emirates',
  us: 'United States',
  drc: 'Democratic Republic of the Congo',
  dprk: 'North Korea',
  sk: 'South Korea',
  nz: 'New Zealand',
  sa: 'Saudi Arabia',
  aus: 'Australia',
};

function collectFromBatch(map: Map<string, BatchPage>, query: string): Candidate[] {
  const candidates: Candidate[] = [];
  for (const page of map.values()) {
    if (candidates.length >= MAX_CANDIDATES) break;
    if (isDisambig(page)) {
      const { extract } = page;
      const entries = parseDisambigExtract(extract || '');
      if (entries.length > 0) {
        const tokens = tokenizeQuery(query);
        const entry =
          tokens.length === 0
            ? entries[0]!
            : entries.reduce((a, b) =>
                scoreEntry(a.title, a.description, tokens, query) >
                scoreEntry(b.title, b.description, tokens, query)
                  ? a
                  : b,
              );
        candidates.push({
          title: entry.title,
          summary: {
            title: entry.title,
            extract: '',
            pageid: 0,
            fullExtract: undefined,
          },
          categories: [],
        });
      }
    } else {
      const c = batchToCandidate(page);
      if (c) candidates.push(c);
    }
  }
  return candidates;
}

async function resolveFromTitle(
  title: string,
): Promise<{ summary: PageSummary; categories: string[] }> {
  const batchMap = await batchFetchPages([title]);
  const page = batchMap.get(title);
  if (page && !isDisambig(page)) {
    const c = batchToCandidate(page);
    if (c) return { summary: c.summary, categories: c.categories };
  }
  return fetchPageData(title);
}

export async function resolveEntity(query: string): Promise<{
  summary: PageSummary;
  categories: string[];
}> {
  let result: { summary: PageSummary; categories: string[] } | null = null;

  const alias = QUERY_ALIASES[query.toLowerCase()];
  if (alias) {
    const batchMap = await batchFetchPages([alias]);
    const page = batchMap.get(alias);
    if (page && !isDisambig(page)) {
      const c = batchToCandidate(page);
      if (c) result = { summary: c.summary, categories: c.categories };
    }
  }

  const titles = result ? [] : await searchWiki(query, MAX_CANDIDATES);
  if (!result && titles.length > 0) {
    const batchMap = await batchFetchPages(titles);
    const candidates = collectFromBatch(batchMap, query);
    const best = bestTokenMatch(candidates, query);
    if (best) result = { summary: best.summary, categories: best.categories };
  }

  if (!result) {
    const genMap = await searchWithData(query, MAX_CANDIDATES);
    if (genMap.size > 0) {
      const candidates = collectFromBatch(genMap, query);
      const best = bestTokenMatch(candidates, query);
      if (best) result = { summary: best.summary, categories: best.categories };
    }
  }

  if (!result) {
    const datamuse = await searchByDatamuse(query);
    if (datamuse) {
      const titles2 = await searchWiki(datamuse, 1);
      if (titles2.length > 0) {
        const batchMap2 = await batchFetchPages([titles2[0]!]);
        const page = batchMap2.get(titles2[0]!);
        if (page && !isDisambig(page)) {
          const c = batchToCandidate(page);
          if (c) result = { summary: c.summary, categories: c.categories };
        }
      }
      if (!result) result = await resolveFromTitle(datamuse);
    }
  }

  if (!result) {
    const fullText = await searchWikiFullText(query);
    if (fullText) result = await resolveFromTitle(fullText);
  }

  if (result) {
    if (!result.summary.fullExtract) {
      const full = await getPageExtract(result.summary.title);
      if (full) result.summary.fullExtract = full;
    }
    return result;
  }

  if (titles.length > 0) {
    const firstSummary = await getPageSummary(titles[0]!);
    const entries = parseDisambigExtract(firstSummary.extract || '');
    if (entries.length > 0) {
      const suggestions = entries
        .slice(0, 8)
        .map((e) => `  \x1b[1m${e.title}\x1b[0m \u2014 ${e.description || 'Wikipedia article'}`)
        .join('\n');
      const more = entries.length > 8 ? `\n  ... and ${entries.length - 8} more` : '';
      throw Object.assign(
        new Error(`"${query}" is ambiguous. Try one of:\n\n${suggestions}${more}`),
        { _suggestions: true },
      );
    }
  }

  throw new Error(`no Wikipedia article found for "${query}"`);
}
