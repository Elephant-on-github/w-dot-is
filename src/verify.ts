import type { VerifyResult } from './types';
import { resolveEntity } from './wikipedia';

function normalize(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function levenshtein(a: string, b: string): number {
  const matrix: number[][] = [];
  for (let i = 0; i <= b.length; i++) matrix[i] = [i];
  for (let j = 0; j <= a.length; j++) matrix[0]![j] = j;
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i - 1] === a[j - 1]) {
        matrix[i]![j] = matrix[i - 1]?.[j - 1]!;
      } else {
        matrix[i]![j] = Math.min(
          matrix[i - 1]?.[j - 1]! + 1,
          matrix[i]?.[j - 1]! + 1,
          matrix[i - 1]?.[j]! + 1,
        );
      }
    }
  }
  return matrix[b.length]?.[a.length]!;
}

export async function verifyClaim(name: string, predicate: string): Promise<VerifyResult> {
  try {
    const { summary, categories } = await resolveEntity(name);
    const normalizedPredicate = normalize(predicate);
    const normalizedTitle = normalize(summary.title);
    const normalizedExtract = normalize(summary.extract);

    const catMatch = categories.some((cat) => {
      const normalizedCat = normalize(cat);
      if (normalizedCat === normalizedPredicate) return true;
      if (normalizedCat.includes(normalizedPredicate)) return true;
      if (normalizedPredicate.includes(normalizedCat)) return true;
      return false;
    });

    const extractMatch =
      normalizedExtract.includes(normalizedPredicate) ||
      normalizedExtract.includes(`${normalizedPredicate} `) ||
      normalizedExtract.includes(` ${normalizedPredicate}`);

    const _titleSimilarity = levenshtein(normalizedTitle, normalizedPredicate);

    const isCategory =
      summary.extract.toLowerCase().includes(`is a ${predicate.toLowerCase()}`) ||
      summary.extract.toLowerCase().includes(`is an ${predicate.toLowerCase()}`);

    const result = catMatch || extractMatch || isCategory;
    const evidence = catMatch
      ? `category match: ${categories.filter((c) => normalize(c).includes(normalizedPredicate)).join(', ')}`
      : extractMatch
        ? 'found in page extract'
        : isCategory
          ? `described as "is a ${predicate}"`
          : 'no match found';

    return { name, predicate, result, evidence };
  } catch {
    return { name, predicate, result: false, evidence: 'could not fetch page' };
  }
}
