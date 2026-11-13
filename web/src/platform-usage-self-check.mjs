import assert from 'node:assert/strict'
import { createPlatformUsage, isForeground } from './platform-usage.mjs'

const handlers = new Map()
const docHandlers = new Map()
const storage = new Map()
const calls = []
const beacons = []
let focused = true
let visibility = 'visible'
let intervalCallback
let intervalCleared = false
const documentRef = {
  get visibilityState() { return visibility },
  addEventListener: (name, callback) => docHandlers.set(name, callback),
  removeEventListener: (name) => docHandlers.delete(name),
}
const windowRef = {
  document: { hasFocus: () => focused },
  crypto: { randomUUID: () => '01234567-89ab-cdef-0123-456789abcdef' },
  addEventListener: (name, callback) => handlers.set(name, callback),
  removeEventListener: (name) => handlers.delete(name),
}
const storageRef = { getItem: (key) => storage.get(key) || null, setItem: (key, value) => storage.set(key, value) }
const navigatorRef = { sendBeacon: (url, body) => { beacons.push({ url, body }); return true } }
const fetchImpl = async (url, options) => { calls.push({ url, options }); return { status: 200 } }
const tracker = createPlatformUsage({
  fetchImpl, documentRef, windowRef, navigatorRef, storageRef,
  setIntervalImpl: (callback) => { intervalCallback = callback; return 1 },
  clearIntervalImpl: () => { intervalCleared = true },
})

assert.equal(isForeground(documentRef, windowRef), true)
tracker.start()
assert.equal(calls[0].url, '/api/usage/sessions/start')
assert.equal(JSON.parse(calls[0].options.body).active, true)
const trackerAgain = createPlatformUsage({ fetchImpl, documentRef, windowRef, navigatorRef, storageRef })
assert.equal(trackerAgain.sessionId, tracker.sessionId, 'StrictMode re-mount should reuse the tab session ID')

focused = false
handlers.get('blur')()
assert.equal(JSON.parse(calls.at(-1).options.body).active, false)
assert.equal(isForeground(documentRef, windowRef), false)
visibility = 'hidden'
docHandlers.get('visibilitychange')()
focused = true
visibility = 'visible'
handlers.get('focus')()
assert.equal(JSON.parse(calls.at(-1).options.body).active, true)
intervalCallback()
assert.equal(calls.at(-1).url, '/api/usage/sessions/heartbeat')

handlers.get('pagehide')()
assert.equal(beacons[0].url, '/api/usage/sessions/end')
assert.equal(JSON.parse(await beacons[0].body.text()).sessionId, tracker.sessionId)
tracker.dispose()
assert.equal(intervalCleared, true)
assert.equal(handlers.has('pagehide'), false)
assert.equal(calls.some((call) => call.url.endsWith('/end')), false, 'effect cleanup must not end a StrictMode session')

let recoveredStart = false
let reconnectHeartbeat
const reconnect = createPlatformUsage({
  fetchImpl: async (url) => { if (url.endsWith('/heartbeat')) return { status: 404 }; if (url.endsWith('/start')) recoveredStart = true; return { status: 200 } },
  documentRef, windowRef, navigatorRef, storageRef,
  setIntervalImpl: (callback) => { reconnectHeartbeat = callback; return 2 }, clearIntervalImpl: () => {},
})
reconnect.start()
reconnectHeartbeat()
reconnect.dispose()
await new Promise((resolve) => setTimeout(resolve, 0))
assert.equal(recoveredStart, true, 'a heartbeat after a server restart should reopen the session')
console.log('Platform usage browser lifecycle self-check passed.')
