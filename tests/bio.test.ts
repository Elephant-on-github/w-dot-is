import { describe, expect, it } from 'bun:test';
import { extractInfo } from '../src/bio';
import type { PageSummary } from '../src/types';

function makeSummary(overrides: Partial<PageSummary> = {}): PageSummary {
  return {
    title: 'Test',
    extract: 'This is a test extract with some information.',
    pageid: 12345,
    ...overrides,
  };
}

describe('extractInfo', () => {
  it('detects person from birth date', () => {
    const summary = makeSummary({
      title: 'Albert Einstein',
      extract:
        'Albert Einstein was born on 14 March 1879. He died on 18 April 1955. Known for: theory of relativity.',
    });
    const info = extractInfo(summary, []);
    expect(info.category).toBe('person');
    expect(info.bioLines.some((l) => l.includes('1879'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('relativity'))).toBe(true);
  });

  it('extracts lifespan and awards from description and extract', () => {
    const summary = makeSummary({
      title: 'Albert Einstein',
      description: 'German-born theoretical physicist (1879–1955)',
      extract:
        'Albert Einstein was a German-born theoretical physicist. He received the 1921 Nobel Prize in Physics.',
    });
    const info = extractInfo(summary, []);
    expect(info.category).toBe('person');
    expect(info.bioLines.some((l) => l.includes('German-born'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('lifespan: 1879–1955'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('Nobel Prize in Physics'))).toBe(true);
  });

  it('detects place from population', () => {
    const summary = makeSummary({
      title: 'France',
      extract: 'France has a population of 68 million. GDP is estimated at $3 trillion.',
    });
    const info = extractInfo(summary, ['Countries']);
    expect(info.category).toBe('place');
    expect(info.bioLines.some((l) => l.includes('population'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('GDP'))).toBe(true);
  });

  it('extracts capital and area for places', () => {
    const summary = makeSummary({
      title: 'France',
      description: 'Country primarily in Western Europe',
      extract:
        'France spans a combined area of 632,702 km2. Its capital is Paris. Population estimated at 69.1 million.',
    });
    const info = extractInfo(summary, ['Countries']);
    expect(info.category).toBe('place');
    expect(info.bioLines.some((l) => l.includes('capital: Paris'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('area:'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('69.1 million'))).toBe(true);
  });

  it('detects living thing from species', () => {
    const summary = makeSummary({
      title: 'Lion',
      extract:
        'The lion (Panthera leo) is a species of big cat. Their habitat is savannas and grasslands.',
    });
    const info = extractInfo(summary, ['Species']);
    expect(info.category).toBe('living_thing');
    expect(info.bioLines.some((l) => l.includes('Panthera leo'))).toBe(true);
  });

  it('extracts taxonomic info for living things', () => {
    const summary = makeSummary({
      title: 'Lion',
      description: 'Large cat species',
      extract:
        'The lion (Panthera leo) is a species of big cat in the family Felidae and order Carnivora.',
    });
    const info = extractInfo(summary, ['Species']);
    expect(info.category).toBe('living_thing');
    expect(info.bioLines.some((l) => l.includes('genus: Panthera'))).toBe(true);
    expect(info.bioLines.some((l) => l.includes('family: Felidae'))).toBe(true);
  });

  it('falls back to thing when no category matches', () => {
    const summary = makeSummary({
      title: 'Banana',
      extract: 'A banana is an elongated, edible fruit.',
    });
    const info = extractInfo(summary, []);
    expect(info.category).toBe('thing');
  });

  it('shows description for thing when available', () => {
    const summary = makeSummary({
      title: 'Computer',
      description: 'Programmable electronic device',
      extract: 'A computer is a machine that can be programmed.',
    });
    const info = extractInfo(summary, []);
    expect(info.category).toBe('thing');
    expect(info.bioLines.some((l) => l.includes('Programmable'))).toBe(true);
  });

  it('returns image URL when available', () => {
    const summary = makeSummary({
      title: 'Test',
      originalimage: { source: 'https://example.com/img.jpg', width: 100, height: 100 },
    });
    const info = extractInfo(summary, []);
    expect(info.imageUrl).toBe('https://example.com/img.jpg');
  });

  it('extracts sports medals from full extract', () => {
    const summary = makeSummary({
      title: 'Usain Bolt',
      extract: 'Usain Bolt is a Jamaican sprinter. He was born on 21 August 1986.',
      description: 'Jamaican sprinter (born 1986)',
      fullExtract:
        'Usain Bolt is a Jamaican sprinter. He was born on 21 August 1986.\n' +
        'Bolt won the gold medal in the 100 metres at the 2008 Summer Olympics.\n' +
        'He also won the silver medal in the 200 metres at the 2008 Olympics.\n' +
        'He is an Olympic gold medalist and world champion in sprint events.\n' +
        'He won 8 Olympic gold medals throughout his career.',
    });
    const info = extractInfo(summary, ['Living people', 'Jamaican male sprinters']);
    expect(info.category).toBe('person');
    const awards = info.bioLines.filter((l) => l.startsWith('awards:'));
    expect(awards.length).toBe(1);
    expect(awards[0]!.toLowerCase()).toContain('gold medal');
  });

  it('extracts achievement section from full extract', () => {
    const fullText =
      'Some intro text here.\n' +
      '== Achievements and titles ==\n' +
      'Gold medal at 2008 Olympics\n' +
      'Silver medal at 2012 Olympics\n' +
      'World record holder in 100m\n' +
      '== Personal life ==\n';
    const summary = makeSummary({
      title: 'Test Athlete',
      extract: 'Test Athlete is a runner.',
      fullExtract: fullText,
    });
    const info = extractInfo(summary, ['Living people']);
    expect(info.category).toBe('person');
    const achievements = info.bioLines.filter((l) => l.startsWith('achievement:'));
    expect(achievements.length).toBe(1);
    expect(achievements[0]).toContain('Gold medal at 2008 Olympics');
    expect(achievements[0]).toContain('Silver medal at 2012 Olympics');
  });

  it('extracts honours section from full extract', () => {
    const fullText =
      'Intro text.\n' +
      '== Honours ==\n' +
      'Order of Merit (2009)\n' +
      'Knight of the Realm (2010)\n' +
      '== References ==\n';
    const summary = makeSummary({
      title: 'Test',
      extract: 'Test is a person.',
      fullExtract: fullText,
    });
    const info = extractInfo(summary, ['Living people']);
    expect(info.category).toBe('person');
    const achievements = info.bioLines.filter((l) => l.startsWith('achievement:'));
    expect(achievements.length).toBe(1);
    expect(achievements[0]).toContain('Order of Merit');
    expect(achievements[0]).toContain('Knight of the Realm');
  });

  it('does not extract medals when fullExtract is absent', () => {
    const summary = makeSummary({
      title: 'Usain Bolt',
      extract: 'Usain Bolt is a Jamaican sprinter.',
    });
    const info = extractInfo(summary, ['Living people']);
    expect(info.category).toBe('person');
    const awards = info.bioLines.filter((l) => l.startsWith('awards:'));
    expect(awards.length).toBe(0);
  });
});
