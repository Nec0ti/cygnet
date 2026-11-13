import { useEffect, useMemo, useState } from 'react'

type Account = { id: string; name: string; username: string; avatar: string; bio?: string; pronouns?: string; verified?: boolean }
type Post = { id: string; accountId: string; image: string; caption: string; location?: string; likes: number; comments: number; time: string; liked?: boolean }
type Story = { id: string; accountId: string; image?: string; caption?: string; seen?: boolean }
type Notification = { id: string; kind: string; accountId: string; text: string; time: string; postImage?: string; isRead?: boolean }
type Message = { id: string; from: 'me' | 'them'; text: string; time: string; image?: string; deleted?: boolean }
type Conversation = { id: string; accountId: string; messages: Message[]; unread?: number }
type Bootstrap = { me: Account; accounts: Account[]; posts: Post[]; stories: Story[]; notifications: Notification[]; conversations: Conversation[] }
type Page = 'home' | 'explore' | 'messages' | 'notifications' | 'profile'

const svgData = (svg: string) => `data:image/svg+xml,${encodeURIComponent(svg)}`
const avatar = (initials: string, color: string) => svgData(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120"><rect width="120" height="120" fill="${color}"/><circle cx="60" cy="45" r="23" fill="#f1d8bd"/><path d="M20 120c3-29 18-43 40-43s37 14 40 43" fill="#263c35"/><path d="M38 42c3-24 44-32 48 2-8-8-12-12-24-12-9 0-16 5-24 10" fill="#46392e"/></svg>`)
const photos = {
  cafe: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><linearGradient id="g" x2="0" y2="1"><stop stop-color="#f4d8ad"/><stop offset=".55" stop-color="#e4b891"/><stop offset=".56" stop-color="#7b7261"/><stop offset="1" stop-color="#443e37"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#g)"/><circle cx="735" cy="260" r="120" fill="#fff0cd" opacity=".8"/><path d="M0 650h1000v350H0z" fill="#514841"/><rect x="115" y="115" width="290" height="500" rx="8" fill="#9aa49a" opacity=".65"/><path d="M535 580h240v45H535z" fill="#d6b38b"/><path d="M580 470h130v110H580z" fill="#efe7d8"/><path d="M710 490h36v52h-36" fill="none" stroke="#efe7d8" stroke-width="16"/><ellipse cx="645" cy="585" rx="190" ry="22" fill="#c49b75"/><path d="M230 250v365m0-240h175M115 390h290" stroke="#f2e1c8" stroke-width="17" opacity=".8"/></svg>'),
  coast: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><linearGradient id="s" x2="0" y2="1"><stop stop-color="#c3d7d1"/><stop offset=".6" stop-color="#f0c5a0"/><stop offset="1" stop-color="#69949a"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#s)"/><circle cx="730" cy="260" r="100" fill="#fff1d7"/><path d="M0 520q200-50 360 10t320 0 320-10v480H0z" fill="#46838b"/><path d="M0 670q180-35 340 15t330 0 330-10v325H0z" fill="#326a75"/><path d="M0 795q230-80 480 0t520-10v215H0z" fill="#d7bc9a"/><path d="M0 820q210-49 430 0t570-15" fill="none" stroke="#f4e1c5" stroke-width="16" opacity=".8"/><path d="M0 565q200-45 390 5t610-12" fill="none" stroke="#c8e0d9" stroke-width="12" opacity=".6"/></svg>'),
  flowers: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><rect width="1000" height="1000" fill="#d9dfc8"/><path d="M0 0h1000v340H0z" fill="#f1d9c7"/><path d="M80 640q220-170 430 0t410-30v390H80z" fill="#84906e"/><g fill="#e7a28b"><circle cx="220" cy="350" r="70"/><circle cx="720" cy="450" r="85"/><circle cx="490" cy="560" r="68"/><circle cx="830" cy="690" r="58"/></g><g fill="#f5d8bf"><circle cx="220" cy="350" r="28"/><circle cx="720" cy="450" r="32"/><circle cx="490" cy="560" r="25"/><circle cx="830" cy="690" r="22"/></g><g stroke="#53674c" stroke-width="17"><path d="M220 420v280M720 535v245M490 630v140M830 748v90"/></g><path d="M220 550q-95-80-120-20 60 90 120 20m500-40q105-95 135-20-70 90-135 20m-365 135q-75-76-110-25 45 80 110 25" fill="#91a17c"/></svg>'),
  city: svgData('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1000 1000"><defs><linearGradient id="n" x2="0" y2="1"><stop stop-color="#38485b"/><stop offset="1" stop-color="#d38f72"/></linearGradient></defs><rect width="1000" height="1000" fill="url(#n)"/><circle cx="500" cy="470" r="125" fill="#f1bd91" opacity=".7"/><path d="M0 620h130V410h160v210h110V300h160v320h100V390h190v230h150v380H0z" fill="#353b49"/><g fill="#efc794"><path d="M160 455h25v40h-25zm55 0h25v40h-25zm165-105h25v45h-25zm55 0h25v45h-25zm55 0h25v45h-25zm210 100h25v45h-25zm55 0h25v45h-25zm55 0h25v45h-25z"/></g><path d="M0 770q240-100 480 0t520-20v250H0z" fill="#292e39"/></svg>'),
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
    bio: value.bio, pronouns: value.pronouns,
  })
  const me = account(raw.me)
  const accounts = raw.accounts.map(account)
  const posts = raw.posts.map((post: any, index: number) => ({
    id: post.id, accountId: post.accountId, image: post.mediaUrl || Object.values(photos)[index % 4],
    caption: post.caption, likes: post.likes, comments: post.comments.length,
    time: relativeTime(post.createdAt), liked: post.likedByMe,
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
  const [profileId, setProfileId] = useState('me')
  const [activeConversation, setActiveConversation] = useState('c1')
  const [newRecipientId, setNewRecipientId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [draft, setDraft] = useState('')
  const [toast, setToast] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [viewStory, setViewStory] = useState<Story | null>(null)
  const [composeKind, setComposeKind] = useState<'post' | 'story'>('post')
  const [showEdit, setShowEdit] = useState(false)
  const [mobileChatOpen, setMobileChatOpen] = useState(false)
  const [showProfileMenu, setShowProfileMenu] = useState(false)

  useEffect(() => { void getJSON().then(({ data: nextData, mocked: isMocked }) => { setData(nextData); setActiveConversation(nextData.conversations[0]?.id || ''); setMocked(isMocked) }) }, [])
  useEffect(() => { if (!toast) return; const id = window.setTimeout(() => setToast(''), 2200); return () => window.clearTimeout(id) }, [toast])

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
  function navigate(target: Page) { setPage(target); if (target === 'profile') setProfileId('me') }
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
  function follow(id: string) { void act('follow.toggle', { targetId: id }); setToast('Following') }
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
    if (recipientId && result?.conversationId) {
      setData((old) => ({ ...old, conversations: old.conversations.map((item) => item.id === pendingId ? { ...item, id: result.conversationId } : item) }))
      setActiveConversation(result.conversationId)
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

  const filteredAccounts = data.accounts.filter((account) => `${account.name} ${account.username}`.toLowerCase().includes(query.toLowerCase()))
  const visiblePosts = page === 'profile' ? data.posts.filter((post) => post.accountId === profileId) : data.posts

  return <div className="app-shell">
    <aside className="rail">
      <button className="brand" onClick={() => navigate('home')} aria-label="Cygnet home"><span className="brand-mark">c</span><span className="brand-word">cygnet</span></button>
      <nav aria-label="Main navigation">
        <NavButton icon="home" label="Home" active={page === 'home'} onClick={() => navigate('home')} />
        <NavButton icon="search" label="Search" active={page === 'explore'} onClick={() => navigate('explore')} />
        <NavButton icon="explore" label="Explore" active={false} onClick={() => navigate('explore')} />
        <NavButton icon="message" label="Messages" active={page === 'messages'} badge="1" onClick={() => navigate('messages')} />
        <NavButton icon="heart" label="Notifications" active={page === 'notifications'} onClick={() => navigate('notifications')} />
        <NavButton icon="plus" label="Create" onClick={() => openComposer()} />
        <button className={`nav-button ${page === 'profile' && profileId === 'me' ? 'active' : ''}`} onClick={() => navigate('profile')}><img className="nav-avatar" src={data.me.avatar} alt=""/><span>Profile</span></button>
      </nav>
      <button className="more-button"><Icon name="more"/><span>More</span></button>
      <div className="rail-foot"><span className="status-dot"/> Local experiment</div>
    </aside>

    <main className="main-area">
      {page === 'home' && <div className="home-layout">
        <section className="feed-column" aria-label="Home feed">
          <div className="mobile-top"><button className="brand small" onClick={() => navigate('home')}><span className="brand-mark">c</span><span className="brand-word">cygnet</span></button><button className="icon-button" onClick={() => navigate('notifications')} aria-label="Notifications"><Icon name="heart"/></button></div>
          <div className="stories-card">
            {data.stories.map((story) => {
              const account = accountById.get(story.accountId) || data.me
              return <button className="story" key={story.id} onClick={() => story.accountId === 'me' && !story.image ? openComposer('story') : setViewStory(story)}>
                <span className={`story-ring ${story.seen ? 'seen' : ''}`}><img src={account.avatar} alt="" /></span>
                <span>{story.accountId === 'me' ? 'Your story' : account.username}</span>
              </button>
            })}
          </div>
          <div className="posts-list">{data.posts.map((post) => <PostCard key={post.id} post={post} account={accountById.get(post.accountId) || data.me} onLike={() => toggleLike(post.id)} onProfile={() => openProfile(post.accountId)} onComment={(content) => content ? void act('comment.create', { postId: post.id, content }) : setToast('Write a comment below the post')} />)}</div>
        </section>
        <aside className="right-column">
          <div className="me-row"><button className="account-link" onClick={() => navigate('profile')}><img src={data.me.avatar} alt=""/><span><b>{data.me.username}</b><small>{data.me.name}</small></span></button><button className="text-link" onClick={() => setShowEdit(true)}>Switch</button></div>
          <div className="section-heading"><span>Suggested for you</span><button className="text-link">See all</button></div>
          {data.accounts.slice(0, 5).map((account, i) => <div className="suggest-row" key={account.id}><button className="account-link" onClick={() => openProfile(account.id)}><img src={account.avatar} alt=""/><span><b>{account.username}</b><small>{i === 0 ? 'Followed by maya + 2 more' : 'Suggested for you'}</small></span></button><button className="text-link" onClick={() => follow(account.id)}>Follow</button></div>)}
          <p className="footer-note">About · Help · Privacy · Terms<br/>© 2026 CYGNET · LOCAL SIMULATION</p>
        </aside>
      </div>}

      {page === 'explore' && <section className="subpage"><header className="page-header"><div><p className="eyebrow">DISCOVER</p><h1>Find your people</h1></div><label className="search-box"><Icon name="search" size={19}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search names or usernames"/></label></header><div className="people-grid">{filteredAccounts.map((account) => <button className="person-card" key={account.id} onClick={() => openProfile(account.id)}><img src={account.avatar} alt=""/><b>{account.name}</b><span>@{account.username}</span><small>{account.bio}</small><span className="small-button">View profile</span></button>)}</div></section>}

      {page === 'messages' && <section className={`messages-page ${mobileChatOpen ? 'chat-open' : ''}`}>
        <div className="inbox-panel"><div className="inbox-title"><div><h2>{data.me.username}</h2><span>Messages</span></div><button className="icon-button" aria-label="New message" onClick={() => setToast('Choose someone from Explore to start a chat')}><Icon name="plus"/></button></div><label className="inbox-search"><Icon name="search" size={17}/><input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search"/></label><div className="inbox-list">{data.conversations.filter((c) => (accountById.get(c.accountId)?.username || '').includes(query.toLowerCase())).map((item) => { const person = accountById.get(item.accountId) || data.me; const last = item.messages[item.messages.length - 1]; return <button className={`inbox-item ${item.id === activeConversation ? 'selected' : ''}`} key={item.id} onClick={() => { setActiveConversation(item.id); setNewRecipientId(null); setMobileChatOpen(true) }}><img src={person.avatar} alt=""/><span><b>{person.name}</b><small>{last?.text || 'Start a conversation'} <i>· {last?.time}</i></small></span>{item.unread ? <span className="unread-dot"/> : null}</button> })}</div></div>
        <div className="chat-panel">{chatAccount && (conversation || newRecipientId) ? <><header className="chat-header"><button className="icon-button back-mobile" onClick={() => setMobileChatOpen(false)} aria-label="Back to conversations"><Icon name="back"/></button><button className="account-link" onClick={() => openProfile(chatAccount.id)}><img src={chatAccount.avatar} alt=""/><span><b>{chatAccount.name}</b><small>@{chatAccount.username}</small></span></button><button className="icon-button" onClick={() => openProfile(chatAccount.id)} aria-label="View profile"><Icon name="more"/></button></header><div className="chat-history"><div className="chat-person"><img src={chatAccount.avatar} alt=""/><b>{chatAccount.name}</b><span>@{chatAccount.username}</span><button onClick={() => openProfile(chatAccount.id)}>View profile</button></div>{(conversation?.messages || []).map((message) => <div className={`message-bubble ${message.from}`} key={message.id}>{message.deleted ? <p className="deleted-message">Message deleted</p> : <>{message.image && <img className="message-image" src={message.image} alt="Attached image"/>}{message.text && <p>{message.text}</p>}</>}{message.from === 'me' && !message.deleted && <button className="delete-message" onClick={() => deleteMessage(message.id)}>Delete</button>}<small>{message.time}</small></div>)}</div><form className="message-form" onSubmit={(e) => { e.preventDefault(); sendMessage() }}><label className="icon-button" aria-label="Attach photo"><Icon name="camera"/><input type="file" accept="image/png,image/jpeg,image/webp,image/gif" hidden onChange={async (e) => { const file = e.target.files?.[0]; if (file) sendMessage(await readDataUrl(file)); e.target.value = '' }}/></label><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Message..."/><button className="send-button" disabled={!draft.trim()}>Send</button></form></> : <div className="empty-chat"><Icon name="message" size={38}/><h2>Your messages</h2><p>Pick a conversation to say hello.</p></div>}</div>
      </section>}

      {page === 'notifications' && <section className="subpage notifications-page"><header className="page-header"><div><p className="eyebrow">YOUR ACTIVITY</p><h1>Notifications</h1></div><button className="quiet-button" onClick={markAllRead}>Mark all as read</button></header><h3 className="group-title">Today</h3>{data.notifications.map((item) => { const person = accountById.get(item.accountId) || data.me; return <div className={`notification-row ${item.isRead ? 'read' : ''}`} key={item.id}><button onClick={() => { readNotification(item.id); openProfile(person.id) }}><img src={person.avatar} alt=""/></button><p><b>{person.username}</b> {item.text} <span>{item.time}</span></p>{item.postImage && <img className="notification-thumb" src={item.postImage} alt="Post thumbnail"/>}{item.kind === 'follow' && <button className="follow-button" onClick={() => follow(person.id)}>Follow</button>}</div> })}</section>}

      {page === 'profile' && <section className="profile-page"><div className="profile-header"><img className="profile-avatar" src={currentProfile.avatar} alt=""/><div className="profile-info"><div className="profile-name-row"><h1>{currentProfile.username}</h1>{profileId === 'me' ? <button className="quiet-button" onClick={() => setShowEdit(true)}>Edit profile</button> : <><button className="primary-button" onClick={() => follow(currentProfile.id)}>Follow</button><button className="quiet-button" onClick={() => openConversationWith(currentProfile.id)}>Message</button><button className="quiet-button" onClick={() => { void act('block.toggle', { targetId: currentProfile.id }); setToast('Block setting updated') }}>Block</button><button className="quiet-button" onClick={() => { void act('report.create', { targetType: 'account', targetId: currentProfile.id, reason: 'User report' }); setToast('Report submitted') }}>Report</button></>}</div><div className="profile-stats"><span><b>{visiblePosts.length}</b> posts</span><span><b>{profileId === 'me' ? 248 : 1250}</b> followers</span><span><b>{profileId === 'me' ? 301 : 412}</b> following</span></div><p><b>{currentProfile.name}</b>{currentProfile.pronouns && <span className="pronouns"> · {currentProfile.pronouns}</span>}<br/>{currentProfile.bio || 'Finding little moments worth keeping.'}</p></div></div><div className="profile-tabs"><button className="active"><Icon name="grid" size={14}/> POSTS</button>{profileId === 'me' && <button onClick={() => openComposer()}><Icon name="plus" size={14}/> NEW POST</button>}</div><div className="profile-grid">{visiblePosts.map((post) => <button key={post.id} onClick={() => setToast(post.caption)}><img src={post.image} alt={post.caption}/><span><Icon name="heart" size={16} filled/> {post.likes} &nbsp; <Icon name="comment" size={16}/> {post.comments}</span></button>)}</div></section>}
    </main>

    <nav className="mobile-nav" aria-label="Mobile navigation"><NavButton icon="home" label="Home" active={page === 'home'} onClick={() => navigate('home')} compact/><NavButton icon="search" label="Explore" active={page === 'explore'} onClick={() => navigate('explore')} compact/><NavButton icon="plus" label="Create" onClick={() => openComposer()} compact/><NavButton icon="message" label="DMs" active={page === 'messages'} onClick={() => navigate('messages')} compact/><button className="mobile-avatar" onClick={() => navigate('profile')}><img src={data.me.avatar} alt="My profile"/></button></nav>

    {showCompose && <ComposeModal kind={composeKind} onClose={() => setShowCompose(false)} onCreate={createPost} />}
    {viewStory && <StoryModal story={viewStory} account={accountById.get(viewStory.accountId) || data.me} onClose={() => setViewStory(null)} />}
    {showEdit && <EditModal me={data.me} onClose={() => setShowEdit(false)} onSave={(patch) => { setData((old) => ({ ...old, me: { ...old.me, ...patch } })); void act('profile.update', { patch }); setShowEdit(false); setToast('Profile updated') }} />}
    {mocked && <div className="mode-badge" role="status">Demo data</div>}
    {toast && <div className="toast" role="status">{toast}</div>}
  </div>
}

function NavButton({ icon, label, active, onClick, badge, compact = false }: { icon: string; label: string; active?: boolean; onClick: () => void; badge?: string; compact?: boolean }) {
  return <button className={`${compact ? 'mobile-nav-button' : 'nav-button'} ${active ? 'active' : ''}`} onClick={onClick} aria-label={label}><span className="nav-icon"><Icon name={icon} filled={active}/>{badge && <i/>}</span>{!compact && <span>{label}</span>}</button>
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

function EditModal({ me, onClose, onSave }: { me: Account; onClose: () => void; onSave: (patch: { name: string; username: string; bio: string; pronouns: string }) => void }) {
  const [name, setName] = useState(me.name)
  const [username, setUsername] = useState(me.username)
  const [bio, setBio] = useState(me.bio || '')
  const [pronouns, setPronouns] = useState(me.pronouns || '')
  const validUsername = /^[a-z0-9._]+$/.test(username)
  return <div className="modal-backdrop" onClick={onClose}><section className="edit-modal" onClick={(e) => e.stopPropagation()}><header><button className="icon-button" onClick={onClose} aria-label="Close"><Icon name="close"/></button><b>Edit profile</b><button className="text-link" disabled={!validUsername} onClick={() => onSave({ name, username, bio, pronouns })}>Done</button></header><label>Name<input value={name} onChange={(e) => setName(e.target.value)} maxLength={80}/></label><label>Username<input value={username} onChange={(e) => setUsername(e.target.value.toLowerCase())} maxLength={30}/></label>{!validUsername && <small>Use lowercase letters, numbers, dots, and underscores.</small>}<label>Pronouns<input value={pronouns} onChange={(e) => setPronouns(e.target.value)} maxLength={40}/></label><label>Bio<textarea value={bio} onChange={(e) => setBio(e.target.value)} maxLength={150}/></label><small>Changes are saved locally to your profile.</small></section></div>
}

function StoryModal({ story, account, onClose }: { story: Story; account: Account; onClose: () => void }) {
  return <div className="story-backdrop" onClick={onClose}><section className="story-viewer" onClick={(e) => e.stopPropagation()}><button className="story-close" onClick={onClose} aria-label="Close story"><Icon name="close"/></button><img src={story.image} alt={story.caption || `${account.username}'s story`}/><div className="story-credit"><img src={account.avatar} alt=""/><b>{account.username}</b>{story.caption && <span>{story.caption}</span>}</div></section></div>
}

export default App
