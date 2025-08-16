import cron from 'node-cron';

export const retryQueue: any[] = [];

export async function checkTikTokFlops(): Promise<any[]> {
  // TODO: implement flop detection
  return [];
}

export function sendTelegramAlert(message: string) {
  console.log(message);
}

cron.schedule("0 */3 * * *", async () => {
  const flops = await checkTikTokFlops();
  if (flops.length) {
    flops.forEach(f => retryQueue.push(f));
    sendTelegramAlert("⚠️ Flops detected and queued for retry.");
  }
});
