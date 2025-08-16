import {
  startRawWatcher as startRawWatcherImpl,
  WatcherEnv,
} from './watch-raw';
import {
  schedulePosts as schedulePostsImpl,
  SchedulerEnv,
} from './schedule-tiktok';
import {
  startFlopCron as startFlopCronImpl,
  FlopEnv,
} from './flop-cron';
import {
  monitorBrowserless as monitorBrowserlessImpl,
  FallbackEnv,
} from './fallback-monitor';

export {
  WatcherEnv,
  SchedulerEnv,
  FlopEnv,
  FallbackEnv,
};

export function startRawWatcher(env: WatcherEnv = process.env as any) {
  return startRawWatcherImpl(env);
}

export function schedulePosts(env: SchedulerEnv = process.env as any) {
  return schedulePostsImpl(env);
}

export function startFlopCron(env: FlopEnv = process.env as any) {
  return startFlopCronImpl(env);
}

export function monitorBrowserless(env: FallbackEnv = process.env as any) {
  return monitorBrowserlessImpl(env);
}

