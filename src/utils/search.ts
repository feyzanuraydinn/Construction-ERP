/**
 * Simple Full-Text Search utilities for client-side searching
 * Since sql.js doesn't support FTS5, we implement basic search in JavaScript
 */

/**
 * Normalize Turkish characters for search
 */
export function normalizeTurkish(text: string): string {
  return text
    .toLowerCase()
    .replace(/ı/g, 'i')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ş/g, 's')
    .replace(/ö/g, 'o')
    .replace(/ç/g, 'c')
    .replace(/İ/g, 'i')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ş/g, 's')
    .replace(/Ö/g, 'o')
    .replace(/Ç/g, 'c');
}

/**
 * Tokenize text into searchable words
 */
export function tokenize(text: string): string[] {
  return normalizeTurkish(text)
    .split(/\s+/)
    .filter((word) => word.length >= 2);
}

/**
 * Check if a text matches a search query
 * Supports:
 * - Multiple words (AND logic)
 * - Turkish character normalization
 * - Partial matching
 */
export function matchesSearch(text: string, query: string): boolean {
  if (!query || !text) return true;

  const normalizedText = normalizeTurkish(text);
  const queryTokens = tokenize(query);

  // All query tokens must be found in the text
  return queryTokens.every((token) => normalizedText.includes(token));
}

/**
 * Calculate search relevance score
 * Higher score = better match
 */
export function calculateRelevance(text: string, query: string): number {
  if (!query || !text) return 0;

  const normalizedText = normalizeTurkish(text);
  const normalizedQuery = normalizeTurkish(query);
  const queryTokens = tokenize(query);

  let score = 0;

  // Exact match gets highest score
  if (normalizedText === normalizedQuery) {
    return 100;
  }

  // Starts with query gets high score
  if (normalizedText.startsWith(normalizedQuery)) {
    score += 50;
  }

  // Contains exact query gets medium score
  if (normalizedText.includes(normalizedQuery)) {
    score += 30;
  }

  // Each matching token adds to score
  queryTokens.forEach((token) => {
    if (normalizedText.includes(token)) {
      score += 10;
      // Word boundary match gets bonus
      const wordBoundaryRegex = new RegExp(`\\b${token}`, 'i');
      if (wordBoundaryRegex.test(normalizedText)) {
        score += 5;
      }
    }
  });

  return score;
}

/**
 * Search and sort results by relevance
 */
export function searchAndSort<T>(
  items: T[],
  query: string,
  getSearchableText: (item: T) => string
): T[] {
  if (!query) return items;

  // Filter items that match
  const matches = items.filter((item) => matchesSearch(getSearchableText(item), query));

  // Sort by relevance
  return matches.sort((a, b) => {
    const scoreA = calculateRelevance(getSearchableText(a), query);
    const scoreB = calculateRelevance(getSearchableText(b), query);
    return scoreB - scoreA;
  });
}

/**
 * Highlight matching text in search results
 */
export function highlightMatches(text: string, query: string): string {
  if (!query || !text) return text;

  const queryTokens = tokenize(query);
  let result = text;

  queryTokens.forEach((token) => {
    // Create case-insensitive regex that also handles Turkish chars
    const regex = new RegExp(`(${escapeRegex(token)})`, 'gi');
    result = result.replace(regex, '<mark>$1</mark>');
  });

  return result;
}

/**
 * Escape special regex characters
 */
function escapeRegex(string: string): string {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Debounced search function creator
 */
export function createDebouncedSearch<T>(
  searchFn: (query: string) => T[],
  delay: number = 300
): (query: string) => Promise<T[]> {
  let timeoutId: NodeJS.Timeout | null = null;

  return (query: string) => {
    return new Promise((resolve) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }

      timeoutId = setTimeout(() => {
        resolve(searchFn(query));
      }, delay);
    });
  };
}

/**
 * Search index for faster repeated searches
 */
export class SearchIndex<T> {
  private items: T[] = [];
  private getSearchableText: (item: T) => string;
  private normalizedCache: Map<T, string> = new Map();

  constructor(getSearchableText: (item: T) => string) {
    this.getSearchableText = getSearchableText;
  }

  /**
   * Update the index with new items
   */
  update(items: T[]): void {
    this.items = items;
    this.normalizedCache.clear();

    // Pre-compute normalized text for each item
    items.forEach((item) => {
      const text = this.getSearchableText(item);
      this.normalizedCache.set(item, normalizeTurkish(text));
    });
  }

  /**
   * Search the index
   */
  search(query: string): T[] {
    if (!query) return this.items;

    const normalizedQuery = normalizeTurkish(query);
    const queryTokens = tokenize(query);

    // Filter and score items
    const results = this.items
      .map((item) => {
        const normalizedText = this.normalizedCache.get(item) || '';

        // Check if all tokens match
        const matches = queryTokens.every((token) => normalizedText.includes(token));
        if (!matches) return null;

        // Calculate score
        let score = 0;
        if (normalizedText === normalizedQuery) score = 100;
        else if (normalizedText.startsWith(normalizedQuery)) score = 50;
        else if (normalizedText.includes(normalizedQuery)) score = 30;

        queryTokens.forEach((token) => {
          if (normalizedText.includes(token)) score += 10;
        });

        return { item, score };
      })
      .filter((result): result is { item: T; score: number } => result !== null)
      .sort((a, b) => b.score - a.score)
      .map((result) => result.item);

    return results;
  }
}
