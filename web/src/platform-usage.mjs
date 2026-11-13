const SESSION_KEY = 'cygnet.platform.session.v1'

export function isForeground(documentRef, windowRef) {
  return documentRef.visibilityState === 'visible' && windowRef.document.hasFocus()
}

export function createPlatformUsage({
  fetchImpl = globalThis.fetch,
  documentRef = globalThis.document,
  windowRef = globalThis.window,
  navigatorRef = globalThis.navigator,
  storageRef = globalThis.sessionStorage,
  setIntervalImpl = globalThis.setInterval,
  clearIntervalImpl = globalThis.clearInterval,
  heartbeatMs = 15_000,
} = {}) {
  let sessionId = storageRef.getItem(SESSION_KEY)
  if (!sessionId) {
    sessionId = windowRef.crypto.randomUUID()
    storageRef.setItem(SESSION_KEY, sessionId)
  }
  let active = false
  let started = false
  let timer = null

  const send = (phase, isActive = false) => Promise.resolve(fetchImpl(`/api/usage/sessions/${phase}`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, active: isActive }), keepalive: true,
  })).then((response) => {
    if (phase === 'heartbeat' && response.status === 404) return send('start', isActive)
  }).catch(() => {})
  const refresh = () => {
    const nextActive = isForeground(documentRef, windowRef)
    if (nextActive !== active) {
      active = nextActive
      void send('heartbeat', active)
    }
  }
  const pageHide = () => {
    const payload = new Blob([JSON.stringify({ sessionId })], { type: 'application/json' })
    if (!navigatorRef.sendBeacon?.('/api/usage/sessions/end', payload)) void send('end')
  }

  return {
    sessionId,
    start() {
      if (started) return
      started = true
      active = isForeground(documentRef, windowRef)
      void send('start', active)
      timer = setIntervalImpl(() => void send('heartbeat', active), heartbeatMs)
      documentRef.addEventListener('visibilitychange', refresh)
      windowRef.addEventListener('focus', refresh)
      windowRef.addEventListener('blur', refresh)
      windowRef.addEventListener('pagehide', pageHide)
    },
    dispose() {
      if (!started) return
      started = false
      if (timer !== null) clearIntervalImpl(timer)
      timer = null
      documentRef.removeEventListener('visibilitychange', refresh)
      windowRef.removeEventListener('focus', refresh)
      windowRef.removeEventListener('blur', refresh)
      windowRef.removeEventListener('pagehide', pageHide)
      // React StrictMode replays effect cleanup in development; pagehide owns real session ending.
    },
  }
}
