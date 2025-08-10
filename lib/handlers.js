import { env } from './env.js';

function checkDomain(url) {
  try {
    const host = new URL(url).hostname;
    if (env.ALLOWED_DOMAINS.length && !env.ALLOWED_DOMAINS.includes(host)) {
      throw new Error('Domain not allowed');
    }
  } catch (e) {
    throw new Error('Invalid URL');
  }
}

export async function stripe_syncFromTracker(args = '') {
  if (env.DRY_RUN) {
    return 'dry-run: stripe.syncFromTracker';
  }
  return `synced 1 product${args ? ' with ' + args : ''}`;
}

export async function notion_createTable(args = '') {
  if (env.DRY_RUN) {
    return 'dry-run: notion.createTable';
  }
  return `created table ${args}`;
}

export async function notion_appendPage(args = '') {
  if (env.DRY_RUN) {
    return 'dry-run: notion.appendPage';
  }
  return `appended page ${args}`;
}

export async function images_generate(args = '') {
  if (env.DRY_RUN) {
    return 'dry-run: images.generate';
  }
  return `generated image for ${args}`;
}

export async function rpa_openAndClick(args = '') {
  const url = typeof args === 'string' ? args : args?.url;
  if (url) checkDomain(url);
  if (env.DRY_RUN) {
    return 'dry-run: rpa.openAndClick';
  }
  return `viewer:https://browserless.io/demo?session=${Date.now().toString(36)}`;
}

export async function executor_plan(args = '') {
  if (env.DRY_RUN) {
    return 'dry-run: executor.plan';
  }
  return `planned: ${args}`;
}

export async function runHandler(name, args = '') {
  const map = {
    'stripe.syncFromTracker': stripe_syncFromTracker,
    'notion.createTable': notion_createTable,
    'notion.appendPage': notion_appendPage,
    'images.generate': images_generate,
    'rpa.openAndClick': rpa_openAndClick,
    'executor.plan': executor_plan,
  };
  const fn = map[name];
  if (!fn) throw new Error('Unknown command');
  return await fn(args);
}
