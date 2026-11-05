type Schedule = (action: () => void, milliseconds: number) => () => void;
const schedule: Schedule = (action, milliseconds) => {
  const timer = setTimeout(action, milliseconds);
  return () => clearTimeout(timer);
};

// Socket delivery is an optimization; the server's persisted completion state is authoritative.
export function watchMatchCompletion(options: {
  fetchPending: () => Promise<{ resultReady: boolean }>;
  onReady: () => void;
  schedule?: Schedule;
}): () => void {
  let stopped = false;
  let cancelTimer = () => {};
  const poll = async () => {
    try {
      const pending = await options.fetchPending();
      if (stopped) return;
      if (pending.resultReady) { stopped = true; options.onReady(); return; }
    } catch { /* A temporary failure keeps the player in the game and retries. */ }
    if (!stopped) cancelTimer = (options.schedule || schedule)(() => { void poll(); }, 1500);
  };
  void poll();
  return () => { stopped = true; cancelTimer(); };
}
