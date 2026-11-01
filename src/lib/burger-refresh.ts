/** Ignore reads started before a save or after the viewer leaves. */
export function createBurgerRefresh<T>(
  read: () => Promise<T>,
  onData: (value: T) => void,
  onError: (error: unknown) => void
) {
  let generation = 0;
  let paused = false;
  let stopped = false;
  let inFlight = false;
  return {
    async refresh() {
      if (paused || stopped || inFlight) return;
      const started = generation;
      inFlight = true;
      try {
        const value = await read();
        if (!stopped && !paused && started === generation) onData(value);
      } catch (error) {
        if (!stopped && !paused && started === generation) onError(error);
      } finally {
        inFlight = false;
      }
    },
    pause() { paused = true; generation++; },
    resume() { paused = false; },
    stop() { stopped = true; generation++; },
  };
}
