import { useEffect, useMemo, useState } from 'react'
import { ResearchPanel } from './ResearchPanel'
import { createPlatformUsage } from './platform-usage.mjs'

type Account = { id: string; name: string; username: string; avatar: string; bio?: string; pronouns?: string; country?: string; followers?: number; following?: number; followedByMe?: boolean; verified?: boolean }
type Post = { id: string; accountId: string; image: string; caption: string; location?: string; likes: number; comments: number; time: string; createdAt?: string; liked?: boolean }
type Story = { id: string; accountId: string; image?: string; caption?: string; seen?: boolean }
type Notification = { id: string; kind: string; accountId: string; text: string; time: string; postImage?: string; isRead?: boolean }
type Message = { id: string; from: 'me' | 'them'; text: string; time: string; image?: string; deleted?: boolean }
type Conversation = { id: string; accountId: string; messages: Message[]; unread?: number }
type Bootstrap = { me: Account; accounts: Account[]; posts: Post[]; stories: Story[]; notifications: Notification[]; conversations: Conversation[] }
type Page = 'home' | 'explore' | 'messages' | 'notifications' | 'profile' | 'activity' | 'settings' | 'research'
type SimSettings = { speedMultiplier: number; maxActivePersonas: number; harassmentMode: boolean; usShare: number; minAge: number; maxAge: number }
type SimEvent = { id: string; actor_id: string; username: string; type: string; payload: Record<string, unknown>; created_at: string }

const svgData = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`
const avatar = (initials: string, color: string) => svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${color}"/><circle cx="60" cy="45" r="23" fill="#f1d8bd"/><path d="M20 120c3-29 18-43 40-43s37 14 40 43" fill="#263c35"/><path d="M38 42c3-24 44-32 48 2-8-8-12-12-24-12-9 0-16 5-24 10" fill="#46392e"/></svg>`)
const photos = {
  cafe: '/demo-images/cafe.png',
  coast: '/demo-images/coast.png',
  flowers: '/demo-images/flowers.png',
  city: '/demo-images/city.png',
}

const seed: Bootstrap = {
  me: { id: 'me', name: 'Alex Morgan', username: 'alexmorgan', avatar: avatar('NG','#b9c4ad'), bio: 'Collecting little moments.', pronouns: 'he/him' },
  accounts: [
    { id: 'maya', name: 'Maya Thompson', username: 'mayainmotion', avatar: avatar('MT','#dcb8a4'), bio: 'Slow mornings, fast trains. ☁️', pronouns: 'she/her' },
    { id: 'leo', name: 'Leo Park', username: 'leopark.jpg', avatar: avatar('LP','#8eaaa7'), bio: 'Making things and making a mess.', pronouns: 'he/they' },
    { id: 'ines', name: 'Inés Rivera', username: 'ines.afterhours', avatar: avatar('IR','#d2a590'), bio: 'A little bit of everywhere.', pronouns: 'she/they' },
    { id: 'sam', name: 'Sam Okafor', username: 'samsideup', avatar: avatar('SO','#b69b7d'), bio: 'Books, basslines, breakfast.', pronouns: 'he/him' },
    { id: 'ella', name: 'Ella Chen', username: 'ellasees', avatar: avatar('EC','#a5b1c2'), bio: 'I take the long way home.', pronouns: 'she/her' },
    { id: 'noah', name: 'Noah Williams', username: 'noah.wav', avatar: avatar('NW','#c1b39e'), bio: 'Small camera, big feelings.', pronouns: 'they/them' },
  ],
  posts: [
    { id: 'p1', accountId: 'maya', image: photos.cafe, caption: 'Found a café that gets the light just right at 4pm. I might become a regular. ☕', location: 'Brooklyn, New York', likes: 128, comments: 14, time: '23 min', liked: false },
    { id: 'p2', accountId: 'ines', image: photos.coast, caption: 'Took the longer route home. Always take the longer route home.', location: 'La Jolla, California', likes: 304, comments: 27, time: '1 hr', liked: true },
    { id: 'p3', accountId: 'leo', image: photos.city, caption: 'The city looked like it was trying to tell me something last night.', location: 'Queens, New York', likes: 86, comments: 9, time: '3 hr', liked: false },
    { id: 'p4', accountId: 'ella', image: photos.flowers, caption: 'Brought these home and immediately forgot every task I had. Worth it.', location: 'Portland, Oregon', likes: 207, comments: 18, time: '5 hr', liked: false },
    { id: 'p5', accountId: 'me', image: photos.flowers, caption: 'Trying to notice the small things today.', location: 'Konya, Türkiye', likes: 32, comments: 4, time: 'Yesterday', liked: false },
  ],
  stories: [
    { id: 's0', accountId: 'me' }, { id: 's1', accountId: 'maya', image: photos.cafe, caption: 'A little afternoon pause.' }, { id: 's2', accountId: 'leo', seen: true, image: photos.city },
    { id: 's3', accountId: 'ines', image: photos.coast }, { id: 's4', accountId: 'sam', image: photos.flowers }, { id: 's5', accountId: 'ella', image: photos.flowers }, { id: 's6', accountId: 'noah', seen: true, image: photos.city },
  ],
  notifications: [
    { id: 'n1', kind: 'like', accountId: 'ines', text: 'liked your photo.', time: '12 min', postImage: photos.flowers },
    { id: 'n2', kind: 'follow', accountId: 'sam', text: 'started following you.', time: '1 hr' },
    { id: 'n3', kind: 'comment', accountId: 'maya', text: 'commented: “This light is everything ✨”', time: '2 hr', postImage: photos.cafe },
  ],
  conversations: [
    { id: 'c1', accountId: 'maya', unread: 1, messages: [{ id: 'm1', from: 'them', text: 'Hey! Are you still going to the little photo walk on Saturday?', time: '10:42' }, { id: 'm2', from: 'me', text: 'I am! I’ll bring the tiny camera.', time: '10:49' }, { id: 'm3', from: 'them', text: 'Perfect. Meet you by the park entrance? 🌿', time: '11:03' }] },
    { id: 'c2', accountId: 'leo', messages: [{ id: 'm4', from: 'them', text: 'Sent you the playlist we talked about.', time: 'Yesterday' }] },
    { id: 'c3', accountId: 'ines', messages: [{ id: 'm5', from: 'them', text: 'That coast photo made me miss summer already.', time: 'Tue' }] },
  ],
}

function Icon({ name, size = 22, filled = false }: { name: string; size?: number; filled?: boolean }) {
  const paths: Record<string, React.ReactNode> = {
    home: <><path d="m3 10 9-7 9 7v10a1 1 0 0 1-1 1h-5v-7H9v7H4a1 1 0 0 1-1-1z" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8"/><path d="m16 16 5 5"/></>,
    explore: <><rect x="3" y="3" width="18" height="18" rx="5"/><circle cx="12" cy="12" r="4"/><path d="m15 9-2 4-4 2 2-4z"/></>,
    message: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></>,
    heart: <><path d="M20.8 8.6c0 4.2-8.8 10.4-8.8 10.4S3.2 12.8 3.2 8.6a4.6 4.6 0 0 1 8.8-1.9 4.6 4.6 0 0 1 8.8 1.9Z"/></>,
    plus: <><path d="M12 5v14M5 12h14"/></>,
    grid: <><rect x="3" y="3" width="8" height="8" rx="1"/><rect x="13" y="3" width="8" height="8" rx="1"/><rect x="3" y="13" width="8" height="8" rx="1"/><rect x="13" y="13" width="8" height="8" rx="1"/></>,
    more: <><circle cx="5" cy="12" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></>,
    bookmark: <><path d="M6 4h12v17l-6-4-6 4z"/></>,
    comment: <><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.4 8.4 0 0 1 3.8-.9h.5a8.5 8.5 0 0 1 8 8z"/></>,
    close: <><path d="m18 6-12 12M6 6l12 12"/></>,
    back: <><path d="m15 18-6-6 6-6"/></>,
    camera: <><path d="M14 4h-4l-2 3H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3z"/><circle cx="12" cy="13" r="3"/></>,
  }
  return <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" fill={filled && name === 'heart' ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">{paths[name]}</svg>
}

function fromAPI(raw: any): Bootstrap {
  const account = (value: any): Account => ({
    id: value.id, name: value.name, username: value.username,
    avatar: value.avatarUrl || avatar(value.name.split(/\s+/).map((part: string) => part[0]).join('').slice(0, 2), '#b9c4ad'),
    bio: value.bio, pronouns: value.pronouns, country: value.country,
    followers: value.followers || 0, following: value.following || 0, followedByMe: value.followedByMe,
  })
  const me = account(raw.me)
  const accounts = raw.accounts.map(account)
  const posts = raw.posts.map((post: any, index: number) => ({
    id: post.id, accountId: post.accountId, image: post.mediaUrl || Object.values(photos)[index % 4],
    caption: post.caption, likes: post.likes, comments: post.comments.length,
    time: relativeTime(post.createdAt), createdAt: post.createdAt, liked: post.likedByMe,
  }))
  const postImages = new Map(posts.map((post: Post) => [post.id, post.image]))
  return {
    me, accounts, posts,
    stories: raw.stories.map((story: any, index: number) => ({ id: story.id, accountId: story.accountId, image: story.mediaUrl || Object.values(photos)[index % 4], caption: story.caption })),
    notifications: raw.notifications.map((item: any) => ({
      id: item.id, kind: item.type, accountId: item.actorId,
      text: item.type === 'like' ? 'liked your photo.' : item.type === 'follow' ? 'started following you.' : item.type === 'comment' ? 'commented on your post.' : `sent you a ${item.type}.`,
      time: relativeTime(item.createdAt), postImage: postImages.get(item.entityId), isRead: item.isRead,
    })),
    conversations: raw.conversations.map((item: any) => ({
      id: item.id, accountId: item.account.id,
      messages: item.messages.map((message: any) => ({
        id: message.id, from: message.senderId === me.id ? 'me' : 'them',
        text: message.content, deleted: message.deleted, time: new Date(message.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        image: message.mediaUrl || undefined,
      })),
    })),
  }
}

function relativeTime(timestamp: string) {
  const minutes = Math.max(0, Math.floor((Date.now() - new Date(timestamp).getTime()) / 60000))
  if (minutes < 60) return `${minutes} min`
  if (minutes < 1440) return `${Math.floor(minutes / 60)} hr`
  return `${Math.floor(minutes / 1440)} d`
}

function readDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image'))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

const getJSON = async (): Promise<{ data: Bootstrap; mocked: boolean }> => {
  if (import.meta.env.VITE_USE_MOCK === 'true') return { data: seed, mocked: true }
  try {
    const response = await fetch('/api/bootstrap')
    if (!response.ok) throw new Error(`API ${response.status}`)
    return { data: fromAPI(await response.json()), mocked: false }
  } catch {
    return { data: seed, mocked: true }
  }
}

function App() {
  const [data, setData] = useState(seed)
  const [mocked, setMocked] = useState(import.meta.env.VITE_USE_MOCK === 'true')
  const [page, setPage] = useState<Page>('home')
  const [profileId, setProfileId] = useState(seed.me.id)
  const [activeConversation, setActiveConversation] = useState('c1')
  const [newRecipientId, setNewRecipientId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [discoveryQuery, setDiscoveryQuery] = useState('')
  const [feedSort, setFeedSort] = useState<'newest' | 'likes' | 'comments'>('newest')
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [viewStory, setViewStory] = useState<Story | null>(null)
  const [composeKind, setComposeKind] = useState<'post' | 'story'>('post')
  const [showEdit, setShowEdit] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [resetStep, setResetStep] = useState<0 | 1 | 2>(0)
  const [resetMinutes, setResetMinutes] = useState<number | null>(null)
  const [resetTypedMinutes, setResetTypedMinutes] = useState('')
  const [resetError, setResetError] = useState('')
  const [resetting, setResetting] = useState(false)
  const [settings, setSettings] = useState<SimSettings>({ speedMultiplier: 1, maxActivePersonas: 10, harassmentMode: false, usShare: 60, minAge: 16, maxAge: 30 })
  const [events, setEvents] = useState<SimEvent[]>([])
  const [nextEventBefore, setNextEventBefore] = useState<string | null>(null)
  const [eventTypeFilter, setEventTypeFilter] = useState('')
  const [eventActorFilter, setEventActorFilter] = useState('')
  const [savingSettings, setSavingSettings] = useState(false)

  useEffect(() => { void getJSON().then(({ data: nextData, mocked: isMocked }) => { setData(nextData); setProfileId(nextData.me.id); setActiveConversation(nextData.conversations[0]?.id || ''); setMocked(isMocked) }) }, [])
  useEffect(() => {
    if (mocked) return
    const tracker = createPlatformUsage()
    tracker.start()
    return () => tracker.dispose()
  }, [mocked])
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(id) }, [toast])
  useEffect(() => {
    if (page === 'settings' && !mocked) void fetch('/api/settings').then((response) => response.json()).then(setSettings).catch(() => {})
    if (page === 'activity' && !mocked) {
      const params = new URLSearchParams({ limit: '100' })
      if (eventTypeFilter.trim()) params.set('type', eventTypeFilter.trim())
      if (eventActorFilter) params.set('actor', eventActorFilter)
      void fetch(`/api/events?${params}`).then((response) => response.json()).then((value) => { setEvents(value.events || []); setNextEventBefore(value.nextBefore || null) }).catch(() => { setEvents([]); setNextEventBefore(null) })
    }
  }, [page, mocked, eventTypeFilter, eventActorFilter])

  const accountById = useMemo(() => new Map([[data.me.id, data.me], ...data.accounts.map((account) => [account.id, account] as const)]), [data])
  const currentProfile = accountById.get(profileId) || data.me
  const conversation = data.conversations.find((item) => item.id === activeConversation)
  const chatAccount = conversation ? accountById.get(conversation.accountId) : newRecipientId ? accountById.get(newRecipientId) : undefined

  async function act(type: string, payload: Record<string, unknown>): Promise<any> {
    try {
      const response = await fetch('/api/actions', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ type, payload: { actorId: data.me.id, ...payload } }) })
      const result = await response.json()
      if (!response.ok) { setToast(result.error || 'The action could not be completed'); return null }
      return result.result
    } catch { return null }
  }
  async function saveSimulationSettings() {
    setSavingSettings(true)
    try {
      const response = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch: settings }) })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'Settings could not be saved')
      setSettings(value.settings)
      setToast('Simulation settings saved')
    } catch (error) { setToast(error instanceof Error ? error.message : 'Settings could not be saved') }
    finally { setSavingSettings(false) }
  }
  async function confirmResetStep() {
    setResetError('')
    try {
      const response = await fetch('/api/usage')
      if (!response.ok) throw new Error('Could not read current platform time')
      const usage = await response.json()
      setResetMinutes(Math.floor(usage.platformMs / 60_000))
      setResetTypedMinutes('')
      setResetStep(2)
    } catch (error) { setResetError(error instanceof Error ? error.message : 'Could not read current platform time') }
  }
  async function resetSimulation() {
    if (resetMinutes === null || resetTypedMinutes !== String(resetMinutes)) return
    setResetting(true); setResetError('')
    try {
      const response = await fetch('/api/reset', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platformMinutes: resetMinutes }) })
      const value = await response.json()
      if (!response.ok) {
        if (Number.isInteger(value.currentMinutes)) setResetMinutes(value.currentMinutes)
        throw new Error(value.error || 'Reset failed')
      }
      window.location.reload()
    } catch (error) { setResetError(error instanceof Error ? error.message : 'Reset failed') }
    finally { setResetting(false) }
  }
  async function loadOlderEvents() {
    if (!nextEventBefore) return
    const params = new URLSearchParams({ limit: '100', before: nextEventBefore })
    if (eventTypeFilter.trim()) params.set('type', eventTypeFilter.trim())
    if (eventActorFilter) params.set('actor', eventActorFilter)
    const value = await fetch(`/api/events?${params}`).then((response) => response.json()).catch(() => null)
    if (value) { setEvents((old) => [...old, ...(value.events || [])]); setNextEventBefore(value.nextBefore || null) }
  }
  async function applyPopulation() {
    try {
      const saved = await fetch('/api/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ patch: settings }) })
      const savedValue = await saved.json()
      if (!saved.ok) throw new Error(savedValue.error || 'Settings could not be saved')
      setSettings(savedValue.settings)
      const response = await fetch('/api/settings/apply-population', { method: 'POST' })
      const value = await response.json()
      if (!response.ok) throw new Error(value.error || 'Population could not be updated')
      setToast(`Updated ${value.updated} persona profiles`)
      const refresh = await getJSON()
      if (!refresh.mocked) setData(refresh.data)
    } catch (error) { setToast(error instanceof Error ? error.message : 'Population could not be updated') }
  }
  function navigate(target: Page) { setPage(target); if (target === 'profile') setProfileId(data.me.id) }
  function openProfile(id: string) { setProfileId(id); setPage('profile') }
  function openConversationWith(accountId: string) {
    const existing = data.conversations.find((item) => item.accountId === accountId)
    setPage('messages')
    setMobileChatOpen(true)
    if (existing) { setActiveConversation(existing.id); setNewRecipientId(null) }
    else { setActiveConversation(''); setNewRecipientId(accountId) }
  }
  function toggleLike(id: string) {
    setData((old) => ({ ...old, posts: old.posts.map((post) => post.id === id ? { ...post, liked: !post.liked, likes: post.likes + (post.liked ? -1 : 1) } : post) }))
    void act('like.toggle', { postId: id })
  }
  async function follow(id: string) {
    const result = await act('follow.toggle', { targetId: id })
    if (!result) return
    const delta = result.following ? 1 : -1
    setData((old) => ({ ...old,
      me: { ...old.me, following: Math.max(0, (old.me.following || 0) + delta) },
      accounts: old.accounts.map((account) => account.id === id ? { ...account, followers: Math.max(0, (account.followers || 0) + delta), followedByMe: result.following } : account),
    }))
    setToast(result.following ? 'Following' : 'Unfollowed')
  }
  async function sendMessage(mediaData?: string) {
    if ((!draft.trim() && !mediaData) || (!conversation && !newRecipientId)) return
    const message = { id: crypto.randomUUID(), from: 'me' as const, text: draft.trim(), time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), image: mediaData }
    const recipientId = newRecipientId
    const pendingId = conversation?.id || `pending-${message.id}`
    setData((old) => ({ ...old, conversations: conversation
      ? old.conversations.map((item) => item.id === conversation.id ? { ...item, messages: [...item.messages, message] } : item)
      : [...old.conversations, { id: pendingId, accountId: recipientId!, messages: [message] }] }))
    setActiveConversation(pendingId)
    setNewRecipientId(null)
    const result = await act('message.send', { ...(conversation ? { conversationId: conversation.id } : { recipientId }), content: message.text, ...(mediaData ? { media: { data: mediaData } } : {}) })
    if (result?.id || result?.conversationId) {
      setData((old) => ({ ...old, conversations: old.conversations.map((item) => item.id === pendingId ? {
        ...item,
        id: result.conversationId || item.id,
        messages: item.messages.map((saved) => saved.id === message.id ? { ...saved, id: result.id || saved.id } : saved),
      } : item) }))
      if (result.conversationId) setActiveConversation(result.conversationId)
    }
    setDraft('')
  }
  function createPost(caption: string, kind: 'post' | 'story', mediaData?: string) {
    void act(kind === 'story' ? 'story.create' : 'post.create', { caption, ...(mediaData ? { media: { data: mediaData } } : {}) })
    setShowCompose(false)
    setToast(kind === 'story' ? 'Your story is on its way' : 'Your post is on its way')
  }
  function openComposer(kind: 'post' | 'story' = 'post') { setComposeKind(kind); setShowCompose(true) }
  function readNotification(id: string) {
    setData((old) => ({ ...old, notifications: old.notifications.map((item) => item.id === id ? { ...item, isRead: true } : item) }))
    void act('notification.read', { notificationId: id })
  }
  function markAllRead() { data.notifications.filter((item) => !item.isRead).forEach((item) => readNotification(item.id)) }
  function deleteMessage(id: string) {
    setData((old) => ({ ...old, conversations: old.conversations.map((item) => item.id === conversation?.id ? { ...item, messages: item.messages.map((message) => message.id === id ? { ...message, text: '', image: undefined, deleted: true } : message) } : item) }))
    void act('message.delete', { messageId: id })
  }

  const normalizedDiscoveryQuery = discoveryQuery.trim().toLocaleLowerCase()
  const filteredAccounts = data.accounts.filter((account) =>
    `${account.name} ${account.username} ${account.bio || ''} ${account.country || ''} ${account.pronouns || ''}`
      .toLocaleLowerCase().includes(normalizedDiscoveryQuery))
  const visiblePosts = page === 'profile' ? data.posts.filter((post) => post.accountId === profileId) : data.posts
  const sortedPosts = [...visiblePosts].sort((a, b) => {
    if (feedSort === 'likes') return b.likes - a.likes
    if (feedSort === 'comments') return b.comments - a.comments
    return b.createdAt && a.createdAt ? b.createdAt.localeCompare(a.createdAt) : visiblePosts.indexOf(a) - visiblePosts.indexOf(b)
  })

  return <div className="app-shell">
    <aside className="rail">
      <button className="brand" onClick={() => navigate('home')} aria-label="Cygnet home"><span className="brand-mark">c</span><span className="brand-word">cygnet</span></button>
      <nav aria-label="Main navigation">
        <NavButton icon="home" label="Home" active={page === 'home'} onClick={() => navigate('home')} />
        <NavButton icon="explore" label="Explore people" active={page === 'explore'} onClick={() => navigate('explore')} />
        <NavButton icon="message" label="Messages" active={page === 'messages'} badge="1" onClick={() => navigate('messages')} />
        <NavButton icon="heart" label="Notifications" active={page === 'notifications'} onClick={() => navigate('notifications')} />
        <NavButton icon="plus" label="Create" onClick={() => openComposer()} />
        <button className={`nav-button ${page === 'profile' && profileId === data.me.id ? 'active' : ''}`} onClick={() => navigate('profile')} aria-current={page === 'profile' && profileId === data.me.id ? 'page' : undefined}><img className="nav-avatar" src={data.me.avatar} alt=""/><span>Profile</span></button>
      </nav>
      <div className="more-area"><button className="more-button" aria-haspopup="menu" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu((open) => !open)}><Icon name="more"/><span>More</span></button>
        {showMoreMenu && <div className="more-menu" role="menu">
          <button role="menuitem" onClick={() => { setPage('activity'); setShowMoreMenu(false) }}>Activity archive</button>
          <button role="menuitem" onClick={() => { setPage('settings'); setShowMoreMenu(false) }}>Simulation settings</button>
          <button role="menuitem" onClick={() => { setPage('research'); setShowMoreMenu(false) }}>Research workspace</button>
          <div className="more-menu-divider"/>
          <button className="danger-menu-item" role="menuitem" onClick={() => { setShowMoreMenu(false); setResetStep(1); setResetError('') }}>Reset simulation</button>
        </div>}
      </div>
      <div className="rail-foot"><span className="status-dot"/> Local experiment</div>
    </aside>

    <main className="main-area">
      {page === 'home' && <div className="home-layout">
        <section className="feed-column" aria-label="Home feed">
          <div className="mobile-top"><button className="brand small" onClick={() => navigate('home')}><span className="brand-mark">c</span><span className="brand-word">cygnet</span></button><button className="icon-button" onClick={() => navigate('notifications')} aria-label="Notifications"><Icon name="heart"/></button></div>
          <div className="stories-card">
            {!data.stories.some((story) => story.accountId === data.me.id) && <button className="story" onClick={() => openComposer('story')}>
              <span className="story-ring"><img src={data.me.avatar} alt="" /></span>
              <span>Your story</span>
            </button>}
            {data.stories.map((story) => {
              const account = accountById.get(story.accountId) || data.me
              return <button className="story" key={story.id} onClick={() => story.accountId === data.me.id && !story.image ? openComposer('story') : setViewStory(story)}>
                <span className={`story-ring ${story.seen ? 'seen' : ''}`}><img src={account.avatar} alt="" /></span>
                <span>{story.accountId === data.me.id ? 'Your story' : account.username}</span>
              </button>
            })}
          </div>
          <div className="feed-toolbar"><h1>Home</h1><label>Sort posts<select aria-label="Sort posts" value={feedSort} onChange={(event) => setFeedSort(event.target.value as typeof feedSort)}><option value="newest">Newest</option><option value="likes">Most liked</option><option value="comments">Most discussed</option></select></label></div>
          <div className="posts-list">{sortedPosts.map((post) => <PostCard key={post.id} post={post} account={accountById.get(post.accountId) || data.me} onLike={() => toggleLike(post.id)} onProfile={() => openProfile(post.accountId)} onComment={(content) => content ? void act('comment.create', { postId: post.id, content }) : setToast('Write a comment below the post')} />)}</div>
        </section>
        <aside className="right-column">
          <div className="me-row"><button className="account-link" onClick={() => navigate('profile')}><img src={data.me.avatar} alt=""/><span><b>{data.me.username}</b><small>{data.me.name}</small></span></button><button className="text-link" onClick={() => setShowEdit(true)}>Switch</button></div>
          <div className="section-heading"><span>Suggested for you</span><button className="text-link">See all</button></div>
          {data.accounts.slice(0, 5).map((account) => <div className="suggest-row" key={account.id}><button className="account-link" onClick={() => openProfile(account.id)}><img src={account.avatar} alt=""/><span><b>{account.username}</b><small>{account.followers ? `${account.followers} followers` : 'Suggested for you'}</small></span></button><button className="text-link" onClick={() => follow(account.id)}>{account.followedByMe ? 'Following' : 'Follow'}</button></div>)}
          <p className="footer-note">About · Help · Privacy · Terms<br/>© 2026 CYGNET · LOCAL SIMULATION</p>
        </aside>
      </div>}

      {page === 'explore' && <section className="subpage" aria-labelledby="discover-heading"><header className="page-header"><div><p className="eyebrow">DISCOVER</p><h1 id="discover-heading">Find your people</h1><p className="page-intro">Search profiles by name, username, bio, country, or pronouns.</p></div><label className="search-box"><Icon name="search" size={19}/><input type="search" aria-label="Search profiles" value={discoveryQuery} onChange={(e) => setDiscoveryQuery(e.target.value)} placeholder="Search profiles"/></label></header><p className="search-result-count" role="status" aria-live="polite">{filteredAccounts.length} {filteredAccounts.length === 1 ? 'profile' : 'profiles'} found</p><div className="people-grid">{filteredAccounts.map((account) => <button className="person-card" key={account.id} onClick={() => openProfile(account.id)} aria-label={`View ${account.name}, @${account.username}`}><img src={account.avatar} alt=""/><b>{account.name}</b><span>@{account.username}</span><small>{account.bio}</small>{account.country && <small>{account.country}</small>}<span className="small-button">View profile</span></button>)}</div>{filteredAccounts.length === 0 && <p className="empty-state">No profiles match “{discoveryQuery}”. Try another search.</p>}</section>}

      {page === 'messages' && <section className={`messages-page ${mobileChatOpen ? 'chat-open' : ''}`}>
        <div className="inbox-panel"><div className="inbox-title"><div><h2>{data.me.username}</h2><span>Messages</span></div><button className="icon-button" aria-label="New message" onClick={() => setToast('Choose someone from Explore to start a chat')}><Icon name="plus"/></button></div><label className="inbox-search"><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"/></label><div className="inbox-list">{data.conversations.filter((c) => (accountById.get(c.accountId)?.username || '').includes(query.toLowerCase())).map((item) => { const person = accountById.get(item.accountId) || data.me; const last = item.messages[item.messages.length - 1]; return <button className={`inbox-item ${item.id === activeConversation ? 'selected' : ''}`} key={item.id} onClick={() => { setActiveConversation(item.id); setNewRecipientId(null); setMobileChatOpen(true) }}><img src={person.avatar} alt=""/><span><b>{person.name}</b><small>{last?.text || 'Start a conversation'} <i>· {last?.time}</i></small></span>{item.unread ? <span className="unread-dot"/> : null}</button> })}</div></div>
        <div className="chat-panel">{chatAccount && (conversation || newRecipientId) ? <><header className="chat-header"><button className="icon-button back-mobile" onClick={() => setMobileChatOpen(false)} aria-label="Back to conversations"><Icon name="back"/></button><button className="account-link" onClick={() => openProfile(chatAccount.id)}><img src={chatAccount.avatar} alt=""/><span><b>{chatAccount.name}</b><small>@{chatAccount.username}</small></span></button><button className="icon-button" onClick={() => openProfile(chatAccount.id)} aria-label="View profile"><Icon name="more"/></button></header><div className="chat-history"><div className="chat-person"><img src={chatAccount.avatar} alt=""/><b>{chatAccount.name}</b><span>@{chatAccount.username}</span><button onClick={() => openProfile(chatAccount.id)}>View profile</button></div>{(conversation?.messages || []).map((message) => <div className={`message-bubble ${message.from}`} key={message.id}>{message.deleted ? <p className="deleted-message">Message deleted</p> : <>{message.image && <img className="message-image" src={message.image} alt="Attached image"/>}{message.text && <p>{message.text}</p>}</>}{message.from === 'me' && !message.deleted && <button className="delete-message" onClick={() => deleteMessage(message.id)}>Delete</button>}<small>{message.time}</small></div>)}</div><form className="message-form" onSubmit={(e) => { e.preventDefault(); sendMessage() }}><label className="icon-button" aria-label="Attach photo"><Icon name="camera"/><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) sendMessage(await readDataUrl(file)); e.target.value = '' }}/></label><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message..."/><button className="send-button" disabled={!draft.trim()}>Send</button></form></> : <div className="empty-chat"><Icon name="message" size={38}/><h2>Your messages</h2><p>Pick a conversation to say hello.</p></div>}</div>
      </section>}

      {page === 'notifications' && <section className="subpage notifications-page"><header className="page-header"><div><p className="eyebrow">YOUR ACTIVITY</p><h1>Notifications</h1></div><button className="quiet-button" onClick={markAllRead}>Mark all as read</button></header><h3 className="group-title">Today</h3>{data.notifications.map((item) => { const person = accountById.get(item.accountId) || data.me; return <div className={`notification-row ${item.isRead ? 'read' : ''}`} key={item.id}><button onClick={() => { readNotification(item.id); openProfile(person.id) }}><img src={person.avatar} alt=""/></button><p><b>{person.username}</b> {item.text} <span>{item.time}</span></p>{item.postImage && <img className="notification-thumb" src={item.postImage} alt="Post thumbnail"/>}{item.kind === 'follow' && <button className="follow-button" onClick={() => follow(person.id)}>Follow</button>}</div> })}</section>}

      {page === 'activity' && <section className="subpage archive-page"><header className="page-header"><div><p className="eyebrow">LOCAL SIMULATION</p><h1>Activity archive</h1><p className="page-intro">A filterable log of persona actions, relationship changes, settings, and simulator errors.</p></div></header><div className="archive-filters"><label>Event type<input value={eventTypeFilter} onChange={(e) => setEventTypeFilter(e.target.value)} placeholder="e.g. message.sent"/></label><label>Account<select value={eventActorFilter} onChange={(e) => setEventActorFilter(e.target.value)}><option value="">All accounts</option><option value="human">You</option>{data.accounts.map((account) => <option key={account.id} value={account.id}>@{account.username}</option>)}</select></label><span>{events.length} events</span></div><div className="events-list">{events.map((event) => <article className="event-row" key={event.id}><time>{new Date(event.created_at).toLocaleString()}</time><b>@{event.username}</b><span>{event.type}</span><code>{JSON.stringify(event.payload)}</code></article>)}{!events.length && <p className="empty-state">No events match these filters.</p>}</div>{nextEventBefore && <button className="quiet-button load-older" onClick={() => void loadOlderEvents()}>Load older events</button>}</section>}

      {page === 'settings' && <section className="subpage settings-page"><header className="page-header"><div><p className="eyebrow">EXPERIMENT CONTROLS</p><h1>Simulation settings</h1><p className="page-intro">Changes are stored locally in SQLite. The worker pool always stays at or below 10 personas.</p></div></header><div className="settings-grid"><article className="setting-card"><h2>Simulation pace</h2><label>Activity speed<select value={settings.speedMultiplier} onChange={(e) => setSettings({ ...settings, speedMultiplier: Number(e.target.value) })}>{[0.25,0.5,1,2,4,8,12].map((speed) => <option key={speed} value={speed}>{speed}×</option>)}</select><small>Changes the delay after each generated action. Existing scheduled times are kept.</small></label><label>Concurrent persona agents<select value={settings.maxActivePersonas} onChange={(e) => setSettings({ ...settings, maxActivePersonas: Number(e.target.value) })}>{Array.from({ length: 10 }, (_, i) => i + 1).map((count) => <option key={count} value={count}>{count}</option>)}</select><small>The orchestrator runs separately.</small></label></article><article className="setting-card"><h2>Population distribution</h2><label>Profiles from the United States: {settings.usShare}%<input type="range" min="0" max="100" value={settings.usShare} onChange={(e) => setSettings({ ...settings, usShare: Number(e.target.value) })}/></label><div className="range-pair"><label>Youngest age<input type="number" min="16" max="30" value={settings.minAge} onChange={(e) => setSettings({ ...settings, minAge: Number(e.target.value) })}/></label><label>Oldest age<input type="number" min="16" max="30" value={settings.maxAge} onChange={(e) => setSettings({ ...settings, maxAge: Number(e.target.value) })}/></label></div><small>Applying this redistributes ages and countries across the 100 original AI personas, then rebuilds their system.md files. Alternate accounts are left unchanged.</small><button className="quiet-button" disabled={mocked || settings.maxAge < settings.minAge} onClick={() => void applyPopulation()}>Apply to personas</button></article><article className="setting-card setting-warning"><h2>Alternate-account scenario</h2><p>When enabled, an AI persona blocked by your human profile can create one linked alternate account and send one non-sexual message. This models block evasion in the local experiment.</p><label className="toggle-row"><input type="checkbox" checked={settings.harassmentMode} onChange={(e) => setSettings({ ...settings, harassmentMode: e.target.checked })}/> Enable block-evasion scenario</label></article></div><button className="primary-button save-settings" disabled={mocked || savingSettings || settings.maxAge < settings.minAge} onClick={() => void saveSimulationSettings()}>{savingSettings ? 'Saving…' : 'Save settings'}</button></section>}
      {page === 'research' && <ResearchPanel accounts={data.accounts} mocked={mocked} />}

      {page === 'profile' && <section className="profile-page"><div className="profile-header"><img className="profile-avatar" src={currentProfile.avatar} alt=""/><div className="profile-info"><div className="profile-name-row"><h1>{currentProfile.username}</h1>{profileId === data.me.id ? <button className="quiet-button" onClick={() => setShowEdit(true)}>Edit profile</button> : <><button className="primary-button" onClick={() => void follow(currentProfile.id)}>{currentProfile.followedByMe ? 'Following' : 'Follow'}</button><button className="quiet-button" onClick={() => openConversationWith(currentProfile.id)}>Message</button><button className="quiet-button" onClick={() => { void act('block.toggle', { targetId: currentProfile.id }); setToast('Block setting updated') }}>Block</button><button className="quiet-button" onClick={() => { void act('report.create', { targetType: 'account', targetId: currentProfile.id, reason: 'User report' }); setToast('Report submitted') }}>Report</button></>}</div><div className="profile-stats"><span><b>{visiblePosts.length}</b> posts</span><span><b>{currentProfile.followers || 0}</b> followers</span><span><b>{currentProfile.following || 0}</b> following</span></div><p><b>{currentProfile.name}</b>{currentProfile.pronouns && <span className="pronouns"> · {currentProfile.pronouns}</span>}<br/>{currentProfile.bio || 'Finding little moments worth keeping.'}</p></div></div><div className="profile-tabs"><button className="active"><Icon name="grid" size={14}/> POSTS</button>{profileId === data.me.id && <button onClick={() => openComposer()}><Icon name="plus" size={14}/> NEW POST</button>}</div><div className="profile-grid">{visiblePosts.map((post) => <button key={post.id} onClick={() => setToast(post.caption)}><img src={post.image} alt={post.caption}/><span><Icon name="heart" size={16} filled/> {post.likes} &nbsp; <Icon name="comment" size={16}/> {post.comments}</span></button>)}</div></section>}
    </main>

    <nav className="mobile-nav" aria-label="Mobile navigation"><NavButton icon="home" label="Home" active={page === 'home'} onClick={() => navigate('home')} compact/><NavButton icon="search" label="Explore" active={page === 'explore'} onClick={() => navigate('explore')} compact/><NavButton icon="plus" label="Create" onClick={() => openComposer()} compact/><NavButton icon="message" label="DMs" active={page === 'messages'} onClick={() => navigate('messages')} compact/><div className="mobile-more-area"><button className="mobile-nav-button" aria-label="More" aria-haspopup="menu" aria-expanded={showMoreMenu} onClick={() => setShowMoreMenu((open) => !open)}><Icon name="more"/></button>{showMoreMenu && <div className="more-menu" role="menu"><button role="menuitem" onClick={() => { setPage('activity'); setShowMoreMenu(false) }}>Activity archive</button><button role="menuitem" onClick={() => { setPage('settings'); setShowMoreMenu(false) }}>Simulation settings</button><button role="menuitem" onClick={() => { setPage('research'); setShowMoreMenu(false) }}>Research workspace</button><div className="more-menu-divider"/><button className="danger-menu-item" role="menuitem" onClick={() => { setShowMoreMenu(false); setResetStep(1); setResetError('') }}>Reset simulation</button></div>}</div><button className="mobile-avatar" onClick={() => navigate('profile')} aria-label="My profile" aria-current={page === 'profile' && profileId === data.me.id ? 'page' : undefined}><img src={data.me.avatar} alt=""/></button></nav>

    {showCompose && <ComposeModal kind={composeKind} onClose={() => setShowCompose(false)} onCreate={createPost} />}
    {viewStory && <StoryModal story={viewStory} account={accountById.get(viewStory.accountId) || data.me} onClose={() => setViewStory(null)} />}
    {showEdit && <EditModal me={data.me} onClose={() => setShowEdit(false)} onSave={async (patch) => { const saved = await act('profile.update', { patch }); if (!saved) return; setData((old) => ({ ...old, me: { ...old.me, ...patch, avatar: saved.avatarUrl || old.me.avatar } })); setShowEdit(false); setToast('Profile updated') }} />}
    {resetStep !== 0 && <ResetModal step={resetStep} minutes={resetMinutes} typed={resetTypedMinutes} error={resetError} busy={resetting} onTyped={setResetTypedMinutes} onClose={() => { setResetStep(0); setResetError('') }} onContinue={() => void confirmResetStep()} onConfirm={() => void resetSimulation()} />}
    {mocked && <div className="mode-badge" role="status">Demo data</div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function NavButton({ icon, label, active, onClick, badge, compact = false }: { icon: string; label: string; active?: boolean; onClick: () => void; badge?: string; compact?: boolean }) {
  return <button className={`${compact ? 'mobile-nav-button' : 'nav-button'} ${active ? 'active' : ''}`} onClick={onClick} aria-label={label} aria-current={active ? 'page' : undefined}><span className="nav-icon"><Icon name={icon} filled={active}/>{badge && <i/>}</span>{!compact && <span>{label}</span>}</button>
}

function PostCard({ post, account, onLike, onProfile, onComment }: { post: Post; account: Account; onLike: () => void; onProfile: () => void; onComment: (content?: string) => void }) {
  const [captionOpen, setCaptionOpen] = useState(false)
  const [comment, setComment] = useState('')
  return <article className="post-card"><header className="post-header"><button className="account-link" onClick={onProfile}><img src={account.avatar} alt=""/><span><b>{account.username}</b><small>{post.location}</small></span></button><button className="icon-button tiny" aria-label="Post options"><Icon name="more"/></button></header><img className="post-image" src={post.image} alt=""/><div className="post-actions"><button className={`icon-button ${post.liked ? 'liked' : ''}`} onClick={onLike} aria-label={post.liked ? 'Unlike post' : 'Like post'}><Icon name="heart" filled={post.liked}/></button><button className="icon-button" onClick={() => onComment()} aria-label="Comment"><Icon name="comment"/></button><button className="icon-button" aria-label="Share"><Icon name="send"/></button><button className="icon-button save" aria-label="Save post"><Icon name="bookmark"/></button></div><div className="post-body"><b>{post.likes.toLocaleString()} likes</b><p><button className="caption-user" onClick={onProfile}>{account.username}</button> {captionOpen ? post.caption : post.caption.length > 110 ? `${post.caption.slice(0, 110)}…` : post.caption}{post.caption.length > 110 && <button className="more-caption" onClick={() => setCaptionOpen(!captionOpen)}>{captionOpen ? ' less' : ' more'}</button>}</p><button className="view-comments" onClick={() => onComment()}>View all {post.comments} comments</button><time>{post.time.toUpperCase()} AGO</time></div><form className="quick-comment" onSubmit={(e) => { e.preventDefault(); if (comment.trim()) onComment(comment.trim()); setComment('') }}><input value={comment} onChange={(e) => setComment(e.target.value)} placeholder="Add a comment..."/><button disabled={!comment.trim()}>Post</button></form></article>
}

function ComposeModal({ kind, onClose, onCreate }: { kind: 'post' | 'story'; onClose: () => void; onCreate: (caption: string, kind: 'post' | 'story', mediaData?: string) => void }) {
  const [caption, setCaption] = useState('')
  const [image, setImage] = useState('')
  const [mediaData, setMediaData] = useState('')
  return <div className="modal-backdrop" onClick={onClose}><section className="compose-modal" onClick={(e) => e.stopPropagation()}><header><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button><b>Create {kind}</b><button className="text-link" disabled={!caption.trim() && !mediaData} onClick={() => onCreate(caption, kind, mediaData || undefined)}>Share</button></header><div className="compose-content">{image ? <img src={image} alt="Selected preview"/> : <div className="upload-placeholder"><span className="upload-icon"><Icon name="camera" size={30}/></span><h2>Share a little moment</h2><p>Choose an image from your device</p><label className="primary-button">Select from computer<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) { setImage(URL.createObjectURL(file)); setMediaData(await readDataUrl(file)) } }}/></label></div>}<textarea value={caption} onChange={(e) => setCaption(e.target.value)} maxLength={2200} placeholder="Write a caption..."/><span className="character-count">{caption.length}/2,200</span></div></section></div>
}

function EditModal({ me, onClose, onSave }: { me: Account; onClose: () => void; onSave: (patch: { name: string; username: string; bio: string; pronouns: string; avatarData?: string }) => void }) {
  const [name, setName] = useState(me.name)
  const [username, setUsername] = useState(me.username)
  const [bio, setBio] = useState(me.bio || '')
  const [pronouns, setPronouns] = useState(me.pronouns || '')
  const [avatarData, setAvatarData] = useState<string>()
  const validUsername = /^[a-z0-9._]+$/.test(username)
  return <div className="modal-backdrop" onClick={onClose}><section className="edit-modal" onClick={(e) => e.stopPropagation()}><header><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button><b>Edit profile</b><button className="text-link" disabled={!validUsername} onClick={() => onSave({ name, username, bio, pronouns, ...(avatarData ? { avatarData } : {}) })}>Done</button></header><label className="avatar-upload"><img src={avatarData || me.avatar} alt="Profile photo preview"/><span>Change profile photo<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={async (e) => { const file=e.target.files?.[0]; if(file) setAvatarData(await readDataUrl(file)); e.target.value='' }}/></span></label><label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}/></label><label>Username<input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={30}/></label>{!validUsername && <small>Use lowercase letters, numbers, dots, and underscores.</small>}<label>Pronouns<input value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={40}/></label><label>Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150}/></label><small>Changes are saved locally to your profile.</small></section></div>
}

function ResetModal({ step, minutes, typed, error, busy, onTyped, onClose, onContinue, onConfirm }: { step: 1 | 2; minutes: number | null; typed: string; error: string; busy: boolean; onTyped: (value: string) => void; onClose: () => void; onContinue: () => void; onConfirm: () => void }) {
  return <div className="modal-backdrop" onClick={onClose}><section className="reset-modal" role="dialog" aria-modal="true" aria-labelledby="reset-title" onClick={(e) => e.stopPropagation()}>
    <h2 id="reset-title">{step === 1 ? 'Reset simulation?' : 'Are you absolutely sure?'}</h2>
    {step === 1 ? <><p>This clears posts, follows, messages, notifications, reports, experiments, event history, and both accumulated time counters. Your profile details and photo will be kept.</p>{error && <p className="reset-error" role="alert">{error}</p>}<div className="reset-actions"><button className="quiet-button" onClick={onClose}>Cancel</button><button className="primary-button" onClick={onContinue}>Continue</button></div></> : <>
      <p className="reset-minute-count">Total time spent on Cygnet: <strong>{minutes ?? '…'} minutes</strong></p>
      <label>Type the number of minutes shown above to confirm<input aria-label="Confirmation minutes" inputMode="numeric" pattern="[0-9]*" value={typed} onChange={(e) => onTyped(e.target.value)} autoFocus/></label>
      <p className="reset-warning">The simulation returns to its initial profiles and seed posts. This cannot be undone.</p>
      {error && <p className="reset-error" role="alert">{error}</p>}
      <div className="reset-actions"><button className="quiet-button" onClick={onClose}>Cancel</button><button className="danger-button" disabled={busy || minutes === null || typed !== String(minutes)} onClick={onConfirm}>{busy ? 'Resetting…' : 'Reset simulation'}</button></div>
    </>}
  </section></div>
}

function StoryModal({ story, account, onClose }: { story: Story; account: Account; onClose: () => void }) {
  return <div className="story-backdrop" onClick={onClose}><section className="story-viewer" onClick={(e) => e.stopPropagation()}><button className="story-close" onClick={onClose} aria-label="Close story"><Icon name="close"/></button><img src={story.image} alt={story.caption || `${account.username}'s story`}/><div className="story-credit"><img src={account.avatar} alt=""/><b>{account.username}</b>{story.caption && <span>{story.caption}</span>}</div></section></div>
}

export default App
