export type EntityCategory = 'person' | 'place' | 'living_thing' | 'thing';

export interface ParsedArgs {
  name: string;
  predicate?: string;
  mode: 'display' | 'verify';
  ascii?: boolean;
  bg?: boolean;
}

export interface PageSummary {
  title: string;
  type?: string;
  extract: string;
  description?: string;
  thumbnail?: { source: string; width: number; height: number };
  originalimage?: { source: string; width: number; height: number };
  pageid: number;
  content_urls?: { desktop: { page: string } };
  categories?: string[];
  fullExtract?: string;
}

export interface ExtractedInfo {
  name: string;
  category: EntityCategory;
  bioLines: string[];
  imageUrl?: string;
}

export interface VerifyResult {
  name: string;
  predicate: string;
  result: boolean;
  evidence?: string;
}
