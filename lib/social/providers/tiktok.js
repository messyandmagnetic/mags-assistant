export async function post({ caption, mediaUrl, linkUrl }) {
  if (!process.env.TIKTOK_API_KEY) {
    console.log('[tiktok] not configured');
    return 'not configured';
  }
  console.log('[tiktok] post', { caption, mediaUrl, linkUrl });
  return 'ok';
}
