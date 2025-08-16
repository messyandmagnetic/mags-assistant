import { SheetRow } from './sheets';

export interface FlopResult {
  row: SheetRow;
  reason: 'low_views' | 'low_likes';
}

/**
 * Determine which posts are flops according to metrics.
 */
export function findFlops(rows: SheetRow[]): FlopResult[] {
  const flops: FlopResult[] = [];
  for (const row of rows) {
    if ((row.views ?? 0) < 500) {
      flops.push({ row, reason: 'low_views' });
    } else if ((row.likes ?? 0) < 10) {
      flops.push({ row, reason: 'low_likes' });
    }
  }
  return flops;
}
