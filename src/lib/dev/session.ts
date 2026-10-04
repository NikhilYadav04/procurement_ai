/**
 * Development-only sign-in.
 *
 * The real session is a non-HttpOnly cookie named `session` holding
 * URL-encoded JSON: { token, user, expiresAt }. The client only parses it and
 * checks expiry, it never verifies the JWT. So a local session can be minted
 * in the browser with no change to any API route.
 *
 * The token below is deliberately not a valid JWT. Anything that actually
 * verifies it server-side will reject it, which is the safety property: this
 * gets you through the client-side gate and nothing more.
 */

/** Inlined by Next at build time, so every dev-only branch is dead-stripped
 *  from a production bundle. */
export const DEV_ENABLED = process.env.NODE_ENV === 'development';

const FLAG = 'procurix.devMode';
const COOKIE = 'session';

export const DEV_USER = {
  id: 'dev-0000-0000-0000',
  name: 'Nikhil Yadav',
  email: 'demo@procurix.test',
  picture: '',
} as const;

/** True only in a dev build where the harness has been switched on. */
export function isDevMode(): boolean {
  if (!DEV_ENABLED || typeof window === 'undefined') return false;
  try {
    return window.localStorage.getItem(FLAG) === '1';
  } catch {
    return false;
  }
}

/**
 * Enables the harness from a URL, so `/dashboard?dev=1` just works and can be
 * bookmarked. `?dev=0` turns it back off. Returns true if the URL changed
 * anything, so the caller can decide whether to reload.
 */
export function syncDevSessionFromUrl(): boolean {
  if (!DEV_ENABLED || typeof window === 'undefined') return false;
  const flag = new URLSearchParams(window.location.search).get('dev');
  if (flag === '1' && !isDevMode()) {
    startDevSession();
    return true;
  }
  if (flag === '0' && isDevMode()) {
    stopDevSession();
    return true;
  }
  return false;
}

export function startDevSession(): void {
  if (!DEV_ENABLED) return;
  const maxAgeSeconds = 7 * 24 * 60 * 60;
  const session = {
    token: 'dev-session-not-a-real-jwt',
    user: DEV_USER,
    expiresAt: Date.now() + maxAgeSeconds * 1000,
  };
  document.cookie =
    `${COOKIE}=${encodeURIComponent(JSON.stringify(session))}` +
    `; Path=/; SameSite=Lax; Max-Age=${maxAgeSeconds}`;
  try {
    window.localStorage.setItem(FLAG, '1');
  } catch {
    /* private mode: the cookie alone still gets you in for this tab */
  }
}

export function stopDevSession(): void {
  document.cookie = `${COOKIE}=; Path=/; Max-Age=0`;
  try {
    window.localStorage.removeItem(FLAG);
  } catch {
    /* nothing to clear */
  }
}
