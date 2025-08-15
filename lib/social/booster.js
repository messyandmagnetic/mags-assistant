import { randomInt } from 'crypto';

export async function runBoosterSequence({ postId, url, caption }) {
  const log = {
    liked: true,
    commented: true,
    saved: true,
    shared: true,
    followUpCommented: false,
  };
  console.log('[booster] like', postId);
  console.log('[booster] comment as @willowhazeltea', caption || '');
  console.log('[booster] save', postId);
  console.log('[booster] copy link', url);
  console.log('[booster] bookmark', postId);
  console.log('[booster] share to DM/clipboard');
  const delayHours = randomInt(2, 5);
  setTimeout(() => {
    console.log(`[booster] follow-up comment after ${delayHours}h`);
    log.followUpCommented = true;
  }, delayHours * 3600 * 1000);
  return log;
}
