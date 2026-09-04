"use client";

import { useCallback, useEffect, useState } from "react";

/**
 * "Casual" identity (design doc §7): who is holding this phone, remembered in
 * localStorage. No PIN — it only gates low-stakes things like emoji reactions.
 * The PIN-backed cookie identity is separate and lives server-side.
 */

export interface CasualMe {
  id: number;
  name: string;
  emoji: string;
  color: string;
}

const KEY = "bgn_me";
const EVENT = "bgn_me_change";

export function readMe(): CasualMe | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as CasualMe) : null;
  } catch {
    return null;
  }
}

export function writeMe(me: CasualMe | null) {
  try {
    if (me) window.localStorage.setItem(KEY, JSON.stringify(me));
    else window.localStorage.removeItem(KEY);
  } catch {
    /* private mode — identity just won't stick */
  }
  window.dispatchEvent(new Event(EVENT));
}

export function useMe(): [CasualMe | null, (me: CasualMe | null) => void, boolean] {
  const [me, setMe] = useState<CasualMe | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const sync = () => setMe(readMe());
    sync();
    setReady(true);
    window.addEventListener(EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((next: CasualMe | null) => writeMe(next), []);
  return [me, update, ready];
}
