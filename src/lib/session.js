import { useEffect, useState } from 'react';
import { api, clearStoredToken } from './api.js';

/*
 * Who is signed in, asked of the server once per page and shared by every
 * component that wants to know. status: 'loading' | 'guest' | 'user'.
 * Where the server is not running (a plain static copy of the site), everyone
 * is a guest.
 */

let current = { status: 'loading', user: null };
let pending = null;
const listeners = new Set();

function publish(next) {
  current = next;
  for (const listener of listeners) listener(current);
}

function load() {
  pending ??= api('/auth/me')
    .then((data) => {
      const user = data?.user ?? data;
      publish(user?.id ? { status: 'user', user } : { status: 'guest', user: null });
    })
    .catch(() => publish({ status: 'guest', user: null }));
  return pending;
}

export function useSession() {
  const [session, setSession] = useState(current);

  useEffect(() => {
    listeners.add(setSession);
    load();
    setSession(current);
    return () => listeners.delete(setSession);
  }, []);

  return session;
}

export function setSignedIn(user) {
  pending = Promise.resolve();
  publish({ status: 'user', user });
}

/** Signs out and opens `to`; pages that need a signed-in visitor never see the gap. */
export async function signOut(to = '/') {
  await api('/auth/logout', { method: 'POST', body: {} }).catch(() => {});
  clearStoredToken();
  window.location.assign(to);
}

/** Only same-site paths are followed after sign-in, never another address. */
export function safeNext(value, fallback = '/packages/') {
  const local = typeof value === 'string' && value.startsWith('/') && !value.startsWith('//') && !value.startsWith('/\\');
  return local ? value : fallback;
}
