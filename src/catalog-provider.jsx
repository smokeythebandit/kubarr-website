import React, { createContext, useContext, useEffect, useState } from 'react';
import { fetchLiveCatalog, readCachedCatalog, writeCachedCatalog } from './live-catalog.js';

const CatalogContext = createContext(null);
const initial = { revision: null, apps: [], source: 'pending', error: null };
let pending;

function subscribe() {
  if (!pending) {
    const controller = new AbortController();
    const entry = { controller, users: 0 };
    entry.promise = fetchLiveCatalog({ signal: controller.signal }).finally(() => { if (pending === entry) pending = null; });
    pending = entry;
  }
  const entry = pending;
  entry.users++;
  return { promise: entry.promise, release() {
    entry.users--;
    if (entry.users === 0) { entry.controller.abort(); if (pending === entry) pending = null; }
  } };
}

export function CatalogProvider({ children }) {
  const [state, setState] = useState(initial);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    let storage;
    try { storage = window.localStorage; } catch { /* Restricted storage. */ }
    const cached = storage && readCachedCatalog(storage);
    if (cached) setState(current => current.source === 'pending' ? { ...cached, source: 'cache', error: null } : current);
    const subscription = subscribe();
    let active = true;
    subscription.promise.then(catalog => {
      if (active) { setState({ ...catalog, source: 'live', error: null }); if (storage) writeCachedCatalog(storage, catalog); }
    }, error => {
      if (active) setState(current => ({ ...current, error: error.message }));
    });
    return () => { active = false; subscription.release(); };
  }, [attempt]);
  return <CatalogContext.Provider value={{ ...state, retry: () => { setState(current => ({ ...current, error: null })); setAttempt(value => value + 1); } }}>{children}</CatalogContext.Provider>;
}

export function useCatalog() {
  const value = useContext(CatalogContext);
  if (!value) throw new Error('CatalogProvider missing');
  return value;
}
