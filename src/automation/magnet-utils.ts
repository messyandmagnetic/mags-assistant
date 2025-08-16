/**
 * Suggest magnet icons based on keyword matches.
 * For now this just echoes unique keywords.
 */
export async function suggestMagnetIcons(keywords: string[]): Promise<string[]> {
  const unique = Array.from(new Set(keywords.map(k => k.toLowerCase())));
  return unique.slice(0, 5);
}
