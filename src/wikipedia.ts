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
  for (const { word } of data) {
    const found = await searchWiki(word, 1);
    if (found.length > 0) return found[0]!;
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

  const parenIndex = lower.lastIndexOf('(');
  if (parenIndex === -1) bonus += 5;

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

    entries.push({
      title,
      description: m[2]?.trim() ?? '',
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

  if (tokens.length === 0) {
    const first = entries[0]!;
    const resolvedTitle = first.title;
    return fetchPageData(resolvedTitle);
  }

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
  const titles = await searchWiki(query, 10);
  if (titles.length === 0) {
    const datamuse = await searchByDatamuse(query);
    if (datamuse) return fetchPageData(datamuse);

    const fullText = await searchWikiFullText(query);
    if (fullText) return fetchPageData(fullText);

    throw new Error(`no Wikipedia article found for "${query}"`);
  }

  const candidates: { title: string; summary: PageSummary; categories: string[] }[] = [];

  for (const title of titles) {
    const summary = await getPageSummary(title);

    if (summary.type !== 'disambiguation') {
      const categories = await getPageCategories(title);
      const fullExtract = await getPageExtract(title);
      if (fullExtract) summary.fullExtract = fullExtract;
      candidates.push({ title, summary, categories });
    } else {
      const resolved = await resolveDisambiguation(query, summary);
      if (resolved) candidates.push({ title: resolved.summary.title, ...resolved });
    }
  }

  if (candidates.length > 0) {
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

    return { summary: candidates[0]!.summary, categories: candidates[0]!.categories };
  }

  const firstSummary = await getPageSummary(titles[0]!);
  const entries = parseDisambigExtract(firstSummary.extract || '');
  const suggestions = entries
    .slice(0, 8)
    .map((e) => `  \x1b[1m${e.title}\x1b[0m \u2014 ${e.description || 'Wikipedia article'}`)
    .join('\n');
  const more = entries.length > 8 ? `\n  ... and ${entries.length - 8} more` : '';

  throw Object.assign(new Error(`"${query}" is ambiguous. Try one of:\n\n${suggestions}${more}`), {
    _suggestions: true,
  });
}
