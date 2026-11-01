// A task boundary lets input, other modules and paint run between GPX batches.
// Abort also releases the timer/listener, including when a view is unmounted.
export function yieldGpx(signal?: AbortSignal): Promise<void> {
  signal?.throwIfAborted()
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(signal?.reason ?? new DOMException('Cancelado.', 'AbortError')) }
    const timer = setTimeout(() => { signal?.removeEventListener('abort', abort); resolve() }, 0)
    signal?.addEventListener('abort', abort, { once: true })
  })
}
