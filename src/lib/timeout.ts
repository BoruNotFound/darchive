/**
 * Race a promise against a timeout. If the promise doesn't settle in `ms`,
 * the returned promise rejects with a labelled error. Used to keep the UI
 * from getting stuck in a "loading…" state when something hangs server-side
 * or in the Supabase client.
 */
export function withTimeout<T>(
  promise: Promise<T> | PromiseLike<T>,
  ms: number,
  label: string,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<T>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `${label} timed out after ${ms}ms. ` +
            "If this persists, your local Supabase session may be stale — try clearing site data.",
        ),
      );
    }, ms);
  });
  return Promise.race([Promise.resolve(promise), timeout]).finally(() => {
    if (timer) clearTimeout(timer);
  });
}
