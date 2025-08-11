export async function post({ caption, mediaUrl, linkUrl }: { caption?: string; mediaUrl?: string; linkUrl?: string }) {
  if (!process.env.TIKTOK_API_KEY) {
    console.log('[tiktok] not configured');
    return 'not configured';
  }
  console.log('[tiktok] post', { caption, mediaUrl, linkUrl });
  return 'ok';
}
