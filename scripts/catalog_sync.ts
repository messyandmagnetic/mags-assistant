import { getStripe } from '../lib/clients/stripe.js';
import { log } from '../lib/logger.js';

export async function syncCatalog() {
  const stripe = getStripe();
  const products = await stripe.products.list({ limit: 100 });
  for (const p of products.data) {
    await log('catalog_sync', 'product', { id: p.id, name: p.name });
  }
  return products.data.length;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  syncCatalog().then((count) => {
    console.log(`Synced ${count} products`);
  });
}
