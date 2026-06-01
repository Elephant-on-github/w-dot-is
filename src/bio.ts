import type { EntityCategory, ExtractedInfo, PageSummary } from './types';

function detectCategory(summary: PageSummary, categories: string[]): EntityCategory {
  const extract = summary.extract.toLowerCase();
  const cats = categories.map((c) => c.toLowerCase());

  const personKeywords = ['born', 'died', 'birth', 'death', 'born:', 'died:'];
  const personCats = ['living people', ' births', ' deaths', 'people from'];

  const placeKeywords = ['population', 'country', 'city', 'located', 'area', 'capital', 'gdp'];
  const placeCats = ['countries', 'cities', 'geography', 'populated places', 'municipalities'];

  const livingKeywords = ['species', 'genus', 'family ', 'habitat', 'endangered', 'extinct'];
  const livingCats = ['species', 'animals', 'plants', 'mammals', 'birds', 'reptiles'];

  if (personCats.some((c) => cats.some((cat) => cat.includes(c)))) return 'person';
  if (placeCats.some((c) => cats.some((cat) => cat.includes(c)))) return 'place';
  if (livingCats.some((c) => cats.some((cat) => cat.includes(c)))) return 'living_thing';

  if (personKeywords.some((k) => extract.includes(k))) return 'person';
  if (placeKeywords.some((k) => extract.includes(k))) return 'place';
  if (livingKeywords.some((k) => extract.includes(k))) return 'living_thing';

  return 'thing';
}

function extractYear(text: string, label: string): string | null {
  const regex = new RegExp(`${label}\\s*(?::\\s*)?([^.<>\\n]+)`, 'i');
  const match = text.match(regex);
  return match ? (match[1]?.trim() ?? null) : null;
}

function extractLifespan(description?: string): string | null {
  if (!description) return null;
  const m = description.match(/\((\d{4})\s*[–-]\s*(\d{4}|present)\)/);
  if (m) return `${m[1]}–${m[2]}`;
  const m2 = description.match(/\((\d{4})\)/);
  if (m2) return m2[1]!;
  return null;
}

function extractDescriptor(extract: string): string | null {
  const m = extract.match(
    /(?:was|is)\s+(?:an?|the)\s+([A-Z][a-z]+(?:[- ][A-Z][a-z]+)*(?: [a-z]+)?(?:,|\s+(?:who|which|best|and|\.|$)))/,
  );
  if (!m) return null;
  const raw = m[1]!.replace(/[,;].*$/, '').trim();
  if (raw.length > 60) return null;
  return raw;
}

function extractMedals(fullExtract: string): string[] {
  const medals: string[] = [];
  const seen = new Set<string>();

  const medalPatterns = [
    /(?:gold|silver|bronze)\s+medal\s+(?:in|at)\s+(?:the\s+)?([^.,]+)/gi,
    /(?:gold|silver|bronze)\s+medal(?:list|ist)/gi,
    /Olympic\s+(?:gold|silver|bronze)\s+medal/gi,
    /world\s+(?:champion|title|record)\s+(?:in|at|holder)\s+([^.,]+)/gi,
    /(?:Olympic|World)\s+(?:gold|silver|bronze)/gi,
    /\d+\s+(?:Olympic|world|national)\s+(?:gold|silver|bronze)\s+medals?/gi,
  ];

  for (const pat of medalPatterns) {
    const matches = fullExtract.match(pat);
    if (matches) {
      for (const m of matches) {
        const t = m.trim().replace(/\s+/g, ' ');
        const key = t.slice(0, 60);
        if (!seen.has(key) && t.length < 80) {
          seen.add(key);
          medals.push(t.charAt(0).toUpperCase() + t.slice(1));
        }
      }
    }
  }

  return medals;
}

function extractAchievementSections(fullExtract: string): string[] {
  const lines: string[] = [];
  const sectionKeywords =
    /\b(?:Achievements?\s+and\s+Titles|Titles|Honours?|Records|Recognition)\b/i;

  const extractLines = fullExtract.split('\n');
  let inSection = false;

  for (const raw of extractLines) {
    const line = raw.trim();
    const isHeader = /^==\s*.+?\s*==$/.test(line);

    if (isHeader) {
      inSection = false;
      if (sectionKeywords.test(line)) inSection = true;
    } else if (inSection && line.length > 5 && line.length < 80) {
      lines.push(line);
    }
  }

  return lines;
}

function extractInfoPerson(summary: PageSummary, extract: string): string[] {
  const lines: string[] = [];

  const lifespan = extractLifespan(summary.description);

  if (summary.description) {
    const clean = summary.description.replace(/\s*\((\d{4}\s*[–-]\s*\d{4}|present)\)/, '');
    if (clean) lines.push(clean);
  } else {
    const descriptor = extractDescriptor(extract);
    if (descriptor) lines.push(descriptor);
  }

  if (lifespan) lines.push(`lifespan: ${lifespan}`);

  const born = extractYear(extract, 'born') || extractYear(summary.extract, 'born');
  const died = extractYear(extract, 'died') || extractYear(summary.extract, 'died');

  if (born && !lifespan) lines.push(`born: ${born}`);
  if (died && !lifespan) lines.push(`died: ${died}`);

  const notableMatch = extract.match(/(?:known for|notable works?)[:;]?\s*([^.\n]+)/i);
  if (notableMatch) lines.push(`notable: ${notableMatch[1]?.trim()}`);

  const awardsNames =
    "Nobel(?: Prize)?|Academy(?: Award)?|Oscar|BAFTA|Emmy|Grammy|Tony|Pulitzer|Golden Globe|Booker|Cannes|Palme dOr|Golden Lion|Golden Bear|Olivier|Critics Choice|Screen Actors Guild|Hugo|Nebula|Edgar|Fields Medal|Turing|Wolf Prize|Kavli|Lasker|MacArthur|National Book Award|National Medal of Science|Presidential Medal of Freedom|Congressional Gold Medal|Legion of Honour|Order of the British Empire|Daytime|Primetime|ALMA|MTV|Kids Choice|Teen Choice|Essence|BET|Image Award|Logie|AACTA|Cesar|Goya|David di Donatello|Japan Academy|Hong Kong Film|Golden Horse|Blue Dragon|Bodil|Guldbagge|Amanda|Jussi|Felix|Romy|Grimme|Adolf Grimme|Deutscher Filmpreis|Polsat|Vizion|Premios Ondas|Premio Nacional|Princess of Asturias|Balzan|Kyoto|Japan Prize|Breakthrough|Shaw|Tang|Abel|Copley|Royal Medal|Rumford|Mullard|Gabor|Davy|Sylvester|Hughes|RAS Gold|Naylor|Leverhulme|Wolfson|Queen Elizabeth Prize|Millennium Technology|Japan International|Asahi|Ishikawa|Kochon|Intel Science|Gairdner|Warren Alpert|Albany|Keio|Honda|Blue Planet|Zayed|King Faisal|Aga Khan|Pritzker|Stirling|RIBA|AIA Gold|Driehaus|Merck|Plimpton|Justin Winsor|John Newbery|Caldecott|Carnegie|Kate Greenaway|Astrid Lindgren|Hans Christian Andersen|Newbery|Coretta Scott King|Michael L Printz|Stonewall|Lambda|PEN|Costa|Whitbread|Samuel Johnson|Baillie Gifford|Women's Prize|Orange Prize|Baileys|Goldsmiths|James Tait Black|Hawthornden|Costa Book|NCR|Ratna|Sahitya|Jnanpith|Bharat";

  const awardItems: string[] = [];
  const achievementItems: string[] = [];

  const nobelMatch =
    extract.match(
      /(?:won|received|awarded)\s+the\s+(\d{4}\s+)?Nobel\s+Prize\s+in\s+([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)/i,
    ) || extract.match(/(?:Nobel\s+Prize)[:;]?\s*(?:in\s+)?(?:winner|laureate|recipient)[^.\n]*/i);
  if (nobelMatch) {
    let field = nobelMatch[2]?.trim() || '';
    field = field.replace(/\s+(for|of|and)\s*$/i, '');
    const year = nobelMatch[1]?.trim();
    if (field) awardItems.push(`Nobel Prize in ${field}${year ? ` (${year})` : ''}`);
  }

  const wonMatch = extract.match(
    new RegExp(
      `(?:won|received|awarded)\\s+(?:the\\s+)?([^.\\n]*?(?:${awardsNames})[^.\\n]*)`,
      'i',
    ),
  );
  const awardsRefMatch = extract.match(
    new RegExp(
      `(?:awards?|prizes?|recipient of)[:;]?\\s*([^.\\n]*?(?:${awardsNames})[^.\\n]*)`,
      'i',
    ),
  );
  const seenAwards = new Set<string>();
  for (const m of [wonMatch, awardsRefMatch]) {
    if (!m) continue;
    let awardText = m[1]?.trim() || '';
    awardText = awardText.replace(/^[,;:\s]+/, '').replace(/^(including|such as|like)\s+/i, '');
    const key = awardText.slice(0, 40);
    if (awardText && !seenAwards.has(key)) {
      seenAwards.add(key);
      awardItems.push(awardText);
    }
  }

  const fullExtract = summary.fullExtract;
  if (fullExtract) {
    const medalLines = extractMedals(fullExtract);
    for (const ml of medalLines) {
      const key = ml.slice(0, 40);
      if (!seenAwards.has(key)) {
        seenAwards.add(key);
        awardItems.push(ml);
      }
    }

    const achievementLines = extractAchievementSections(fullExtract);
    for (const al of achievementLines) {
      const key = al.slice(0, 40);
      if (!seenAwards.has(key)) {
        seenAwards.add(key);
        achievementItems.push(al);
      }
    }
  }

  if (awardItems.length) lines.push(`awards: ${awardItems.slice(0, 3).join(', ')}`);
  if (achievementItems.length)
    lines.push(`achievement: ${achievementItems.slice(0, 3).join(', ')}`);

  const netWorthMatch = extract.match(
    /net worth[:\s]*\$?([0-9,.]+(?:\s*(?:million|billion|trillion))?)/i,
  );
  if (netWorthMatch) lines.push(`net worth: $${netWorthMatch[1]?.trim()}`);

  return lines;
}

function extractInfoPlace(_summary: PageSummary, extract: string): string[] {
  const lines: string[] = [];

  if (_summary.description) {
    lines.push(_summary.description);
  }

  const populationMatch = extract.match(
    /population\D*?([0-9,.]+(?:\s*(?:million|billion|thousand|trillion))?)/i,
  );
  if (populationMatch) lines.push(`population: ${populationMatch[1]?.trim()}`);

  const gdpMatch = extract.match(/GDP\D*?\$?([0-9,.]+(?:\s*(?:million|billion|trillion))?)/i);
  if (gdpMatch) lines.push(`GDP: $${gdpMatch[1]?.trim()}`);

  const areaMatch =
    extract.match(/area[:\s]+([0-9,.]+(?:\s*km²|\s*km2|\s*sq\s*mi(?:les)?)?)/i) ||
    extract.match(/area\s+of\s+([0-9,.]+(?:\s*km²|\s*km2|\s*sq\s*mi(?:les)?)?)/i);
  if (areaMatch) lines.push(`area: ${areaMatch[1]?.trim()}`);

  const capitalMatch =
    extract.match(/(?:capital|capital city)[:\s]+(?:of\s+)?([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/) ||
    extract.match(
      /capital(?:,| is)(?: the)?(?: largest city)?(?: and main cultural and economic centre)? (?:and main cultural and economic centre )?(?:is |of |, )?([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/,
    ) ||
    extract.match(/capital[^.!]*?\b(is|are)\s+([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)/);
  if (capitalMatch) {
    const cap = (capitalMatch[2] || capitalMatch[1])?.trim();
    if (cap && cap.length > 1) lines.push(`capital: ${cap}`);
  }

  const langMatch =
    extract.match(/(?:official language|national language)[:\s]+([^.,\n]+)/i) ||
    extract.match(
      /([A-Z][a-z]+(?:\s[A-Z][a-z]+)?)\s+is\s+(?:the\s+)?(?:official|national)\s+language/i,
    );
  if (langMatch) lines.push(`language: ${langMatch[1]?.trim()}`);

  const currencyMatch =
    extract.match(/(?:currency)[:\s]+([^.,\n]+)/i) ||
    extract.match(/currency is the\s+([^.,\n]+)/i);
  if (currencyMatch) lines.push(`currency: ${currencyMatch[1]?.trim()}`);

  return lines;
}

function extractInfoLiving(_summary: PageSummary, extract: string): string[] {
  const lines: string[] = [];

  if (_summary.description) {
    lines.push(_summary.description);
  }

  const scientificMatch = extract.match(/\(([A-Z][a-z]+(?:\s+[a-z]+)+)\)/);
  if (scientificMatch) {
    const parts = scientificMatch[1]!.split(' ');
    if (parts.length >= 2) {
      lines.push(`genus: ${parts[0]!}`);
      lines.push(`species: ${scientificMatch[1]?.trim()}`);
    } else {
      lines.push(`species: ${scientificMatch[1]?.trim()}`);
    }
  }

  const speciesMatch = extract.match(/(?:species|scientific name)[:\s]+([^.\n]+)/i);
  if (speciesMatch && !scientificMatch) {
    lines.push(`species: ${speciesMatch[1]?.trim()}`);
  }

  const genusMatch = extract.match(/\bgenus\s+(\w+)/i);
  if (genusMatch && !scientificMatch) lines.push(`genus: ${genusMatch[1]!}`);

  const familyMatch = extract.match(/\bfamily\s+(\w+)/i);
  if (familyMatch) lines.push(`family: ${familyMatch[1]!}`);

  const orderMatch = extract.match(/\border\s+(\w+)/i);
  if (orderMatch) lines.push(`order: ${orderMatch[1]!}`);

  const habitatMatch = extract.match(/habitat[:\s]*([^.\n]+)/i);
  if (habitatMatch) lines.push(`habitat: ${habitatMatch[1]?.trim()}`);

  const statusMatch = extract.match(
    /(?:conservation status|endangered|threatened|extinct)[:\s]*([^.\n]+)/i,
  );
  if (statusMatch) lines.push(`status: ${statusMatch[0]?.trim()}`);

  const locationMatch = extract.match(/(?:found in|native to|located in)[:\s]*([^.\n]+)/i);
  if (locationMatch) lines.push(`location: ${locationMatch[1]?.trim()}`);

  return lines;
}

function extractInfoThing(summary: PageSummary, _extract: string): string[] {
  const lines: string[] = [];

  if (summary.description) {
    lines.push(summary.description);
  }

  const firstSentence = summary.extract.split(/[.\n]/).filter((s) => s.trim().length > 0)[0];
  if (firstSentence) {
    const trimmed = firstSentence.trim();
    if (trimmed !== summary.description) {
      lines.push(trimmed);
    }
  }

  return lines;
}

export function extractInfo(summary: PageSummary, categories: string[]): ExtractedInfo {
  const category = detectCategory(summary, categories);
  const extract = summary.extract;

  let bioLines: string[];

  switch (category) {
    case 'person':
      bioLines = extractInfoPerson(summary, extract);
      break;
    case 'place':
      bioLines = extractInfoPlace(summary, extract);
      break;
    case 'living_thing':
      bioLines = extractInfoLiving(summary, extract);
      break;
    default:
      bioLines = extractInfoThing(summary, extract);
  }

  if (bioLines.length === 0) {
    const firstSentence = extract.split(/[.\n]/).filter((s) => s.trim().length > 0)[0];
    if (firstSentence) {
      bioLines.push(firstSentence.trim());
    }
  }

  if (bioLines.length > 6) bioLines = bioLines.slice(0, 6);

  const imageUrl = summary.originalimage?.source || summary.thumbnail?.source;

  return {
    name: summary.title,
    category,
    bioLines,
    imageUrl,
  };
}
