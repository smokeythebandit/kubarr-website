import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchLiveCatalog, freshFor, readCachedCatalog, retainFor, writeCachedCatalog } from './live-catalog.js';

const CatalogContext = createContext(null);
const initial = { revision: null, apps: [], source: 'pending', error: null, checking: false };
let pending;
let memory;
let failure;
const retryAfter = 60 * 1000;

function usable(catalog) {
  return catalog && catalog.savedAt <= Date.now() && Date.now() - catalog.savedAt <= retainFor;
}

function subscribe(cached, storage) {
  if (!pending) {
    const controller = new AbortController();
    const entry = { controller, users: 0 };
    entry.promise = fetchLiveCatalog({ signal: controller.signal, cached }).then(catalog => {
      if (!controller.signal.aborted) {
        memory = { ...catalog, savedAt: Date.now() };
        failure = null;
        if (storage) writeCachedCatalog(storage, catalog, memory.savedAt);
      }
      return catalog;
    }, error => {
      if (!controller.signal.aborted) failure = { error: error.message, at: Date.now() };
      throw error;
    }).finally(() => { if (pending === entry) pending = null; });
    pending = entry;
  }
  const entry = pending;
  entry.users++;
  return { promise: entry.promise, release() {
    entry.users--;
    // StrictMode's effect replay can resubscribe before the microtask runs.
    if (entry.users === 0) queueMicrotask(() => {
      if (entry.users === 0 && pending === entry) { pending = null; entry.controller.abort(); }
    });
  } };
}

export function CatalogProvider({ children }) {
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let storage;
    try { storage = window.localStorage; } catch { /* Restricted storage. */ }
    if (!usable(memory)) memory = null;
    // Another tab may have saved a newer catalog while this page stayed open.
    const stored = storage && readCachedCatalog(storage);
    const cached = stored && (!memory || stored.savedAt > memory.savedAt) ? stored : memory;
    if (cached) memory = cached;
    const forced = attempt > 0;
    const cooling = !forced && failure && Date.now() - failure.at < retryAfter;
    const fresh = !forced && cached && Date.now() - cached.savedAt < freshFor;
    if (cached) setState({ ...cached, source: 'cache', error: cooling ? failure.error : null, checking: !fresh && !cooling });
    else if (cooling) setState({ ...initial, error: failure.error });
    if (fresh || cooling) return;
    const subscription = subscribe(cached, storage);
    let active = true;
    subscription.promise.then(catalog => {
      if (active) setState({ ...catalog, source: 'live', error: null, checking: false });
    }, error => {
      if (active) setState(current => ({ ...current, error: error.message, checking: false }));
    });
    return () => { active = false; subscription.release(); };
  }, [attempt]);
  return <CatalogContext.Provider value={{ ...state, retry: () => { setState(current => ({ ...current, source: current.apps.length ? 'cache' : 'pending', error: null, checking: true })); setAttempt(value => value + 1); } }}>{children}</CatalogContext.Provider>;
}

// Isolate module-level browser cache between tests; production never invokes this.
export function resetCatalogCacheForTests() { pending = null; memory = null; failure = null; }

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('CatalogProvider missing');
  return value;
}
