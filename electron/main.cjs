const { app, BrowserWindow, dialog, utilityProcess } = require('electron')
const { createServer } = require('node:net')
const path = require('node:path')

app.setAppUserModelId('io.github.nec0ti.cygnet')
const singleInstance = app.requestSingleInstanceLock()
if (!singleInstance) app.quit()

let api
let window

function freePort() {
  return new Promise((resolve, reject) => {
    const probe = createServer()
    probe.once('error', reject)
    probe.listen(0, '127.0.0.1', () => {
      const { port } = probe.address()
      probe.close((error) => error ? reject(error) : resolve(port))
    })
  })
}

async function waitForApi(url) {
  for (let attempt = 0; attempt < 300; attempt++) {
    if (api.exitCode !== null) throw new Error('The local Cygnet service stopped during startup.')
    try { if ((await fetch(`${url}/api/usage`)).ok) return } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100))
  }
  throw new Error('The local Cygnet service did not become ready within 30 seconds.')
}

async function start() {
  const root = app.isPackaged ? process.resourcesPath : path.resolve(__dirname, '..')
  const port = await freePort()
  const url = `http://127.0.0.1:${port}`
  const dataDir = process.env.PORTABLE_EXECUTABLE_DIR
    ? path.join(process.env.PORTABLE_EXECUTABLE_DIR, 'Cygnet-data')
    : app.getPath('userData')
  api = utilityProcess.fork(path.join(root, 'server', 'src', 'server.js'), [], {
    cwd: root,
    env: {
      ...process.env,
      CYGNET_DATA_DIR: dataDir,
      CYGNET_STATIC_DIR: path.join(root, 'web', 'dist'),
      CYGNET_PORT: String(port),
    },
  })
  api.once('exit', (code) => {
    if (code && !app.isQuitting) dialog.showErrorBox('Cygnet stopped', 'The local service stopped unexpectedly. Restart Cygnet to continue.')
    app.quit()
  })
  await waitForApi(url)
  window = new BrowserWindow({
    width: 1440,
    height: 940,
    minWidth: 360,
    minHeight: 560,
    backgroundColor: '#121512',
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })
  await window.loadURL(url)
  if (process.env.CYGNET_DESKTOP_SMOKE === '1') app.quit()
}

app.on('second-instance', () => {
  if (window) { if (window.isMinimized()) window.restore(); window.focus() }
})
app.on('before-quit', () => { app.isQuitting = true; api?.kill() })
app.whenReady().then(() => singleInstance && start()).catch((error) => {
  dialog.showErrorBox('Could not start Cygnet', `${error.message}\n\nCheck that Cygnet can write to its user data folder, then restart it.`)
  app.quit()
})
app.on('window-all-closed', () => app.quit())
