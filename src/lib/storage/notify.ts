const EVENT = 'ht:data'

export function notifyDataChanged() {
  window.dispatchEvent(new CustomEvent(EVENT))
}

export function subscribeData(cb: () => void) {
  const handler = () => cb()
  window.addEventListener(EVENT, handler)
  window.addEventListener('storage', handler)
  return () => {
    window.removeEventListener(EVENT, handler)
    window.removeEventListener('storage', handler)
  }
}
