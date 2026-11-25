"use client";
import { useEffect, useState } from "react";
import type { ApiError } from "./api";

interface Result<T> {
  key: string;
  data?: T;
  error?: ApiError;
}

/**
 * Runs an API call whenever `deps` change (or `reload()` is called).
 * `loading` is true while a call for the current deps is in flight; the previous
 * data stays available meanwhile so tables don't flash empty while paging.
 */
export function useApi<T>(fn: () => Promise<T>, deps: unknown[]) {
  const [tick, setTick] = useState(0);
  const [result, setResult] = useState<Result<T>>();
  const key = `${JSON.stringify(deps)}#${tick}`;

  useEffect(() => {
    let alive = true;
    fn()
      .then((data) => alive && setResult({ key, data }))
      .catch((error: ApiError) => alive && setResult((prev) => ({ key, data: prev?.data, error })));
    return () => {
      alive = false;
    };
    // `fn` is intentionally not a dependency: `key` already encodes `deps`.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const current = result?.key === key;
  return {
    data: result?.data,
    error: current ? result?.error : undefined,
    loading: !current,
    reload: () => setTick((t) => t + 1),
  };
}
