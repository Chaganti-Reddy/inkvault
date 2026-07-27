// Tiny toast pub/sub — no context plumbing. Call toast(message, type) from anywhere.
const listeners = new Set();
let seq = 0;

export function toast(message, type = 'info') {
  const item = { id: ++seq, message, type };
  listeners.forEach((l) => l(item));
}

export function subscribeToasts(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
