/** Bounded workers preserve page order and drain cancelled work before returning an error. */
export async function parallelPages<T>(count: number, signal: AbortSignal, work: (page: number, signal: AbortSignal) => Promise<T>, concurrency = 3): Promise<T[]> {
  const controller = new AbortController();
  const combined = AbortSignal.any([signal, controller.signal]);
  const results: T[] = new Array(count);
  let next = 1;
  let failed = false;
  let failure: unknown;
  async function worker() {
    while (!combined.aborted && next <= count) {
      const page = next++;
      try { results[page - 1] = await work(page, combined); }
      catch (error) { if (!failed) { failed = true; failure = error; controller.abort(error); } return; }
    }
  }
  await Promise.all(Array.from({length: Math.min(count, Math.max(1, concurrency))}, worker));
  signal.throwIfAborted();
  if (failed) throw failure;
  return results;
}
