/**
 * Development-only API stand-in.
 *
 * Wraps window.fetch and answers the routes the UI needs, so the whole product
 * can be driven with no Supabase, no Google OAuth and no Gemini key. No API
 * route is modified: this lives entirely in the browser.
 *
 * The handlers and their fixtures are loaded with a dynamic import behind
 * DEV_ENABLED, so a production build neither runs nor ships them.
 *
 * Anything not handled falls through to the real fetch, so a route you do have
 * credentials for still works normally.
 */

import { DEV_ENABLED, isDevMode } from './session';

let installed = false;

/** Idempotent. Safe to call on every mount. */
export function installDevApi(): void {
  if (!DEV_ENABLED || installed || typeof window === 'undefined') return;
  installed = true;

  const realFetch = window.fetch.bind(window);

  window.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
    if (!isDevMode()) return realFetch(input, init);

    const url =
      typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

    let path: string;
    try {
      path = new URL(url, window.location.origin).pathname;
    } catch {
      return realFetch(input, init);
    }
    const handled = path.startsWith('/api/') || path.startsWith('/rest/v1/');
    if (!handled) return realFetch(input, init);

    const { handle } = await import('./handlers');
    const mocked = await handle(path, init);
    if (mocked) {
      // eslint-disable-next-line no-console
      console.debug(`[dev-api] ${init?.method ?? 'GET'} ${path}`);
      return mocked;
    }
    return realFetch(input, init);
  };
}
