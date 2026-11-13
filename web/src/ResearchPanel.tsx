import { useEffect, useState } from 'react'

type Account = { id: string; name: string; username: string }
type Report = {
  from: string; to: string; generatedAt: string; settings: Record<string, unknown>
  usage: { serverMs: number; platformMs: number; activeSessions: number }
  totals: Record<string, number>; followChanges: { created: number; removed: number; net: number }
  daily: Array<{ date: string } & Record<string, number>>
  personas: Array<{ id: string; username: string } & Record<string, number>>
}
type Experiment = {
  id: string; label: string; startedAt: string; finishedAt: string | null
  settings: Record<string, unknown>
  cohorts: { a: { name: string; condition: string; accountIds: string[] }; b: { name: string; condition: string; accountIds: string[] } }
}
type Comparison = { cohorts: Record<'a' | 'b', { name: string; accounts: number; totalEvents: number; eventsPerAccount: number; events: Record<string, number> }> }
type ReplayEvent = { id: string; actor_id: string; username: string; type: string; payload: Record<string, unknown>; created_at: string }
type Usage = { serverMs: number; platformMs: number; activeSessions: number }
type Tab = 'report' | 'experiments' | 'replay'

const experimentTargetMs = 7 * 24 * 60 * 60 * 1000
const isoDay = (date: Date) => date.toISOString().slice(0, 10)
const defaultFrom = () => { const date = new Date(); date.setUTCDate(date.getUTCDate() - 6); return isoDay(date) }
const today = () => isoDay(new Date())
const duration = (milliseconds: number) => {
  const seconds = Math.floor(milliseconds / 1000), days = Math.floor(seconds / 86400), hours = Math.floor(seconds % 86400 / 3600), minutes = Math.floor(seconds % 3600 / 60)
  return days ? `${days}d ${hours}h ${minutes}m` : hours ? `${hours}h ${minutes}m` : `${minutes}m ${seconds % 60}s`
}

async function requestJSON<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, init)
  const value = await response.json()
  if (!response.ok) throw new Error(value.error || `Request failed (${response.status})`)
  return value as T
}

export function ResearchPanel({ accounts, mocked }: { accounts: Account[]; mocked: boolean }) {
  const [tab, setTab] = useState<Tab>('report')
  const [from, setFrom] = useState(defaultFrom)
  const [to, setTo] = useState(today)
  const [report, setReport] = useState<Report | null>(null)
  const [experiments, setExperiments] = useState<Experiment[]>([])
  const [comparison, setComparison] = useState<Comparison | null>(null)
  const [selectedExperiment, setSelectedExperiment] = useState('')
  const [label, setLabel] = useState('')
  const [cohortA, setCohortA] = useState<string[]>([])
  const [cohortB, setCohortB] = useState<string[]>([])
  const [conditionA, setConditionA] = useState('concise')
  const [conditionB, setConditionB] = useState('expressive')
  const [replayEvents, setReplayEvents] = useState<ReplayEvent[]>([])
  const [usage, setUsage] = useState<Usage | null>(null)
  const [replayIndex, setReplayIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    if (tab !== 'experiments' || mocked) return
    void requestJSON<{ experiments: Experiment[] }>('/api/experiments').then((value) => setExperiments(value.experiments)).catch((reason: Error) => setError(reason.message))
  }, [tab, mocked])
  useEffect(() => {
    if (!playing) return
    const timer = window.setInterval(() => setReplayIndex((index) => Math.min(index + 1, replayEvents.length - 1)), 900)
    return () => window.clearInterval(timer)
  }, [playing, replayEvents.length])
  useEffect(() => { if (playing && replayEvents.length && replayIndex >= replayEvents.length - 1) setPlaying(false) }, [playing, replayEvents.length, replayIndex])
  useEffect(() => {
    if (mocked) return
    let alive = true
    const load = () => { void requestJSON<Usage>('/api/usage').then((value) => { if (alive) setUsage(value) }).catch(() => {}) }
    load()
    const timer = window.setInterval(load, 15_000)
    return () => { alive = false; window.clearInterval(timer) }
  }, [mocked])

  async function loadReport() {
    setError(''); setBusy(true)
    try { setReport(await requestJSON<Report>(`/api/report?${new URLSearchParams({ from, to })}`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Report could not be loaded') }
    finally { setBusy(false) }
  }
  async function refreshExperiments() {
    const value = await requestJSON<{ experiments: Experiment[] }>('/api/experiments')
    setExperiments(value.experiments)
  }
  async function startExperiment(event: React.FormEvent) {
    event.preventDefault(); setError('')
    if (!cohortA.length || !cohortB.length) { setError('Choose at least one persona for each cohort.'); return }
    if (cohortA.some((id) => cohortB.includes(id))) { setError('A persona cannot be in both cohorts.'); return }
    setBusy(true)
    try {
      await requestJSON('/api/experiments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label, cohortA, cohortB, conditionA, conditionB }) })
      setLabel(''); await refreshExperiments()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Experiment could not be started') }
    finally { setBusy(false) }
  }
  async function showComparison(id: string) {
    setError(''); setBusy(true); setSelectedExperiment(id)
    try { setComparison(await requestJSON<Comparison>(`/api/experiments/${encodeURIComponent(id)}`)) }
    catch (reason) { setError(reason instanceof Error ? reason.message : 'Comparison could not be loaded') }
    finally { setBusy(false) }
  }
  async function finishExperiment(id: string) {
    setError(''); setBusy(true)
    try {
      const value = await requestJSON<{ comparison: Comparison }>('/api/experiments/' + encodeURIComponent(id) + '/finish', { method: 'POST' })
      setComparison(value.comparison); setSelectedExperiment(id); await refreshExperiments()
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Experiment could not be finished') }
    finally { setBusy(false) }
  }
  async function loadReplay() {
    setError(''); setBusy(true); setPlaying(false)
    try {
      const start = `${from}T00:00:00.000Z`
      const end = `${to}T23:59:59.999Z`
      const value = await requestJSON<{ events: ReplayEvent[] }>(`/api/replay?${new URLSearchParams({ from: start, to: end, limit: '5000' })}`)
      setReplayEvents(value.events); setReplayIndex(0)
    } catch (reason) { setError(reason instanceof Error ? reason.message : 'Replay could not be loaded') }
    finally { setBusy(false) }
  }

  const reportUrl = `/api/report.csv?${new URLSearchParams({ from, to })}`
  const active = experiments.find((item) => !item.finishedAt)
  const currentEvent = replayEvents[replayIndex]
  const visibleReplayStart = Math.max(0, replayIndex - 25)
  const visibleReplay = replayEvents.slice(visibleReplayStart, Math.min(replayEvents.length, replayIndex + 26))
  return <section className="subpage research-page">
    <header className="page-header"><div><p className="eyebrow">LOCAL EXPERIMENTS</p><h1>Research workspace</h1><p className="page-intro">Reports use saved activity. Cohort prompts change only response length. Replay is read-only and never repeats social actions.</p></div></header>
    {usage && <div className="usage-grid" aria-label="Cumulative time"><article className="metric-card"><span>Server open time</span><b>{duration(usage.serverMs)}</b><small>Saved checkpoints include previous runs.</small></article><article className="metric-card"><span>Your platform time</span><b>{duration(usage.platformMs)}</b><small>Visible, focused browser time · {usage.activeSessions} active tab{usage.activeSessions === 1 ? '' : 's'}</small></article><article className="metric-card"><span>Seven day experiment target</span><b>{Math.min(100, Math.floor(usage.platformMs / experimentTargetMs * 100))}%</b><progress aria-label="Seven day platform time progress" max={experimentTargetMs} value={Math.min(experimentTargetMs, usage.platformMs)} /><small>{duration(Math.max(0, experimentTargetMs - usage.platformMs))} remaining platform time</small></article></div>}
    <nav className="research-tabs" aria-label="Research tools">
      {([['report', 'Reports'], ['experiments', 'Cohort experiments'], ['replay', 'Event replay']] as const).map(([key, text]) => <button key={key} type="button" aria-pressed={tab === key} className={tab === key ? 'active' : ''} onClick={() => { setTab(key); setError('') }}>{text}</button>)}
    </nav>
    {mocked && <p className="empty-state">Connect the local API to use experiment tools.</p>}
    {error && <p className="research-error" role="alert">{error}</p>}

    {tab === 'report' && <div className="research-panel">
      <div className="archive-filters"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><button type="button" className="primary-button" disabled={mocked || busy} onClick={() => void loadReport()}>{busy ? 'Loading…' : 'Build report'}</button>{report && <a className="quiet-button" href={reportUrl}>Download CSV</a>}</div>
      {report && <>
        <p className="report-meta">Generated {new Date(report.generatedAt).toLocaleString()} · {report.from} to {report.to} · cumulative server open: {duration(report.usage.serverMs)} · platform foreground: {duration(report.usage.platformMs)}</p>
        <div className="metric-grid">{Object.entries(report.totals).map(([key, value]) => <article className="metric-card" key={key}><span>{key.replace(/[A-Z]/g, (letter) => ` ${letter}`).replace(/^./, (letter) => letter.toUpperCase())}</span><b>{value}</b></article>)}</div>
        <article className="setting-card report-settings"><h2>Settings snapshot</h2><code>{JSON.stringify(report.settings, null, 2)}</code><p>Follow changes: {report.followChanges.created} created · {report.followChanges.removed} removed · net {report.followChanges.net}</p></article>
        <h2 className="research-heading">Daily activity</h2><div className="table-scroll"><table><thead><tr><th>Date</th><th>Posts</th><th>Stories</th><th>DMs</th><th>Likes</th><th>Comments</th><th>Follows</th><th>Reports</th><th>Images</th><th>Image failures</th><th>Active personas</th></tr></thead><tbody>{report.daily.map((day) => <tr key={day.date}><th scope="row">{day.date}</th>{['posts','stories','dms','likes','comments','follows','reports','images','imageFailures','activePersonas'].map((key) => <td key={key}>{day[key] ?? 0}</td>)}</tr>)}</tbody></table></div>
        <h2 className="research-heading">Persona activity</h2><div className="table-scroll"><table><thead><tr><th>Persona</th><th>Posts</th><th>Stories</th><th>DMs</th><th>Likes</th><th>Comments</th><th>Follows</th><th>Reports</th><th>Images</th><th>Image failures</th></tr></thead><tbody>{report.personas.filter((person) => Object.entries(person).some(([key, value]) => key !== 'id' && key !== 'username' && typeof value === 'number' && value > 0)).map((person) => <tr key={person.id}><th scope="row">@{person.username}</th>{['posts','stories','dms','likes','comments','follows','reports','images','imageFailures'].map((key) => <td key={key}>{person[key] ?? 0}</td>)}</tr>)}</tbody></table></div>
      </>}
    </div>}

    {tab === 'experiments' && <div className="research-panel">
      <form className="experiment-form" onSubmit={(event) => void startExperiment(event)}>
        <h2>Start a controlled comparison</h2><p>Assign separate personas to concise or expressive response styles. Public content and age boundaries stay in force.</p>
        <label>Experiment name<input required maxLength={100} value={label} onChange={(event) => setLabel(event.target.value)} placeholder="e.g. Reply length" /></label>
        <div className="cohort-grid"><CohortPicker title="Cohort A" accounts={accounts} value={cohortA} onChange={setCohortA} /><CohortPicker title="Cohort B" accounts={accounts} value={cohortB} onChange={setCohortB} /></div>
        <div className="condition-grid"><label>Cohort A response style<select value={conditionA} onChange={(event) => setConditionA(event.target.value)}><option value="concise">Concise</option><option value="expressive">Expressive</option></select></label><label>Cohort B response style<select value={conditionB} onChange={(event) => setConditionB(event.target.value)}><option value="expressive">Expressive</option><option value="concise">Concise</option></select></label></div>
        <button className="primary-button" disabled={mocked || busy || Boolean(active)}>{active ? 'Finish the active experiment first' : busy ? 'Starting…' : 'Start experiment'}</button>
      </form>
      <h2 className="research-heading">Saved experiments</h2>
      {!experiments.length && <p className="empty-state">No cohort experiments yet.</p>}
      {experiments.map((experiment) => <article className="experiment-row" key={experiment.id}><div><b>{experiment.label}</b><p>{new Date(experiment.startedAt).toLocaleString()} · {experiment.finishedAt ? `ended ${new Date(experiment.finishedAt).toLocaleString()}` : 'running'}</p><small>A: {experiment.cohorts.a.accountIds.length} personas · {experiment.cohorts.a.condition} / B: {experiment.cohorts.b.accountIds.length} personas · {experiment.cohorts.b.condition}</small></div><div className="experiment-actions"><button type="button" className="quiet-button" disabled={busy} onClick={() => void showComparison(experiment.id)}>Compare</button>{!experiment.finishedAt && <button type="button" className="quiet-button" disabled={busy} onClick={() => void finishExperiment(experiment.id)}>End</button>}</div></article>)}
      {comparison && <section className="comparison-grid" aria-label={`Comparison for ${experiments.find((item) => item.id === selectedExperiment)?.label || 'experiment'}`}>{(['a','b'] as const).map((key) => <article className="setting-card" key={key}><h3>Cohort {key.toUpperCase()}</h3><b>{comparison.cohorts[key].totalEvents} events</b><span>{comparison.cohorts[key].eventsPerAccount.toFixed(1)} per persona across {comparison.cohorts[key].accounts}</span><code>{JSON.stringify(comparison.cohorts[key].events, null, 2)}</code></article>)}</section>}
    </div>}

    {tab === 'replay' && <div className="research-panel"><div className="archive-filters"><label>From<input type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></label><label>To<input type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></label><button className="primary-button" type="button" disabled={mocked || busy} onClick={() => void loadReplay()}>{busy ? 'Loading…' : 'Load events'}</button></div><p className="report-meta">Read-only timeline. Selecting or playing an event never repeats its action.</p>{replayEvents.length > 0 && <><div className="replay-controls"><button className="quiet-button" type="button" onClick={() => setPlaying((value) => !value)}>{playing ? 'Pause' : 'Play'}</button><input aria-label="Replay position" type="range" min="0" max={replayEvents.length - 1} value={replayIndex} onChange={(event) => { setPlaying(false); setReplayIndex(Number(event.target.value)) }} /><span>{replayIndex + 1} / {replayEvents.length}</span></div><article className="event-row replay-current" aria-live="polite"><time>{new Date(currentEvent.created_at).toLocaleString()}</time><b>@{currentEvent.username}</b><span>{currentEvent.type}</span><code>{JSON.stringify(currentEvent.payload)}</code></article><p className="report-meta">Showing nearby events {visibleReplayStart + 1}–{visibleReplayStart + visibleReplay.length} of {replayEvents.length}.</p><div className="events-list">{visibleReplay.map((event, offset) => { const index = visibleReplayStart + offset; return <button type="button" className={`event-row replay-item ${index === replayIndex ? 'active' : ''}`} key={event.id} onClick={() => { setPlaying(false); setReplayIndex(index) }}><time>{new Date(event.created_at).toLocaleString()}</time><b>@{event.username}</b><span>{event.type}</span><code>{JSON.stringify(event.payload)}</code></button> })}</div></>}{replayEvents.length === 0 && <p className="empty-state">Choose a range and load the activity timeline.</p>}</div>}
  </section>
}

function CohortPicker({ title, accounts, value, onChange }: { title: string; accounts: Account[]; value: string[]; onChange: (value: string[]) => void }) {
  const [query, setQuery] = useState('')
  const normalized = query.trim().toLocaleLowerCase()
  const visible = accounts.filter((account) => `${account.name} ${account.username}`.toLocaleLowerCase().includes(normalized))
  return <fieldset className="cohort-picker"><legend>{title} ({value.length})</legend><label>Find a persona<input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Name or username" /></label><div className="cohort-options">{visible.map((account) => <label key={account.id}><input type="checkbox" checked={value.includes(account.id)} onChange={(event) => onChange(event.target.checked ? [...value, account.id] : value.filter((id) => id !== account.id))} /><span>{account.name}</span><small>@{account.username}</small></label>)}{!visible.length && <small>No personas found.</small>}</div></fieldset>
}
