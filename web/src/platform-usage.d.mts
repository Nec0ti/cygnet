export function isForeground(documentRef: Document, windowRef: Window): boolean
export function createPlatformUsage(options?: {
  fetchImpl?: typeof fetch
  documentRef?: Document
  windowRef?: Window
  navigatorRef?: Navigator
  storageRef?: Storage
  setIntervalImpl?: typeof setInterval
  clearIntervalImpl?: typeof clearInterval
  heartbeatMs?: number
}): { sessionId: string; start(): void; dispose(): void }
