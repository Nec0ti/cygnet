import { openStore, HUMAN_ID, logEvent, saveSystemFile, transaction } from './store.js';
import { randomUUID } from 'node:crypto';

const countryPool = [
  ['United Kingdom', 5], ['Canada', 5], ['Australia', 4], ['India', 4], ['Brazil', 3],
  ['Japan', 3], ['Germany', 3], ['France', 2], ['Nigeria', 2], ['Mexico', 2],
  ['South Korea', 2], ['Türkiye', 2], ['Philippines', 2], ['South Africa', 1],
];
const firstNames = ['Avery','Jordan','Taylor','Morgan','Riley','Cameron','Casey','Quinn','Alex','Jamie','Rowan','Skyler','Sage','Noah','Maya','Liam','Olivia','Ethan','Emma','Leo','Amara','Zara','Aisha','Kai','Yuki','Hana','Arjun','Priya','Mateo','Lucia','Sofia','Luca','Theo','Nia','Tariq','Min','Jae','Samira','Diego','Ines'];
const lastNames = ['Carter','Brooks','Reed','Hayes','Bennett','Collins','Rivera','Morgan','Parker','Bailey','Gray','Foster','Kim','Patel','Okafor','Santos','Tanaka','Müller','Dubois','Khan','Silva','Williams','Johnson','Nguyen','Ali','Costa','Martin','Cohen','Brown','Davis'];
const bios = [
  'Collecting little moments and overthinking all of them.',
  'Coffee, playlists, and long walks with no destination.',
  'Trying to make something good out of ordinary days.',
  'Bookmarked too many recipes. Still learning to cook.',
  'Here for art, music, and the occasional bad joke.',
  'Usually listening more than talking.',
  'A curious mind with a very full camera roll.',
  'Making a life that feels like mine.',
];
const captions = [
  'A small reset after a long week.', 'The light was too good not to stop.',
  'Found a quiet corner and stayed a while.', 'Current mood: taking the scenic route.',
  'Today needed a little color.', 'No big plan, just a good afternoon.',
  'Saving this one for later.', 'A moment I almost walked past.',
];
const pronouns = ['she/her','he/him','they/them','she/they','he/they'];
const traitNames = ['warmth','curiosity','nerdiness','sociability','shyness','assertiveness','humor','trust'];
const countries = countryPool.flatMap(([name, count]) => Array(count).fill(name));
const now = new Date().toISOString();

function hash(n) { return (n * 48271) % 2147483647; }
function choose(list, seed) { return list[hash(seed) % list.length]; }
function makeUsername(name, i) {
  return `${name.toLowerCase().replace(/[^a-z]/g, '')}${String(i + 1).padStart(3, '0')}`;
}
function systemMarkdown(account, friends = []) {
  const traits = Object.entries(account.traits).map(([name, value]) => `- ${name}: ${value}/100`).join('\n');
  return `# ${account.name} (@${account.username})\n\n## Identity\n\n- Age: ${account.age}\n- Country: ${account.country}\n- Pronouns: ${account.pronouns}\n- Bio: ${account.bio}\n- Conversation tone: ${account.tone}\n\n## Personality (0-100)\n\n${traits}\n\n## Friends\n\n${friends.length ? friends.map((friend) => `- @${friend}`).join('\n') : '- No close friends yet.'}\n\n## Extra notes\n\n- Write naturally in English.\n- Keep posts and interactions consistent with this profile and recent context.\n`;
}

export function seedStore(db, { dataRoot } = {}) {
  const count = db.prepare('SELECT COUNT(*) AS n FROM accounts').get().n;
  if (count) return { seeded: false, accounts: count };

  const accounts = [];
  for (let i = 0; i < 100; i++) {
    const name = `${choose(firstNames, i + 13)} ${choose(lastNames, i * 3 + 19)}`;
    const country = i < 60 ? 'United States' : countries[i - 60];
    const traits = Object.fromEntries(traitNames.map((trait, j) => [trait, 10 + hash(i * 11 + j * 7) % 81]));
    const row = {
      id: `ai-${String(i + 1).padStart(3, '0')}`,
      name,
      username: makeUsername(name, i),
      bio: choose(bios, i * 17 + 3),
      pronouns: choose(pronouns, i * 13 + 7),
      age: 16 + hash(i * 31 + 5) % 15,
      country,
      traits,
      tone: choose(['gentle and thoughtful','dry and observant','bright and chatty','measured and direct','playful and curious','quiet and sincere'], i * 23 + 2),
    };
    accounts.push(row);
  }
  const human = {
    id: HUMAN_ID, name: 'You', username: 'you', bio: '', pronouns: '', age: null,
    country: '', traits: {}, tone: 'human',
  };
  const insertAccount = db.prepare(`INSERT INTO accounts
    (id,name,username,bio,pronouns,age,country,is_human,tone,traits_json,system_md,created_at)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?)`);

  transaction(db, () => {
    insertAccount.run(HUMAN_ID, human.name, human.username, human.bio, human.pronouns, null, '', 1, '', '{}', '', now);
    for (const account of accounts) {
      insertAccount.run(account.id, account.name, account.username, account.bio, account.pronouns,
        account.age, account.country, 0, account.tone, JSON.stringify(account.traits), systemMarkdown(account), now);
    }

    const insertEdge = db.prepare('INSERT INTO edges(source_id,target_id,kind,created_at) VALUES(?,?,?,?) ON CONFLICT DO NOTHING');
    for (let i = 0; i < accounts.length; i++) {
      const targetCount = 2 + hash(i * 47 + 1) % 5;
      for (let j = 0; j < targetCount; j++) {
        const target = accounts[hash(i * 101 + j * 17 + 9) % accounts.length];
        if (target.id !== accounts[i].id) insertEdge.run(accounts[i].id, target.id, 'friend', now);
      }
    }

    const saveSystem = db.prepare('UPDATE accounts SET system_md=? WHERE id=?');
    for (const account of accounts) {
      const friends = db.prepare(`SELECT a.username FROM edges e JOIN accounts a ON a.id=e.target_id
        WHERE e.source_id=? AND e.kind='friend' ORDER BY a.username`).all(account.id).map((x) => x.username);
      saveSystem.run(systemMarkdown(account, friends), account.id);
    }

    const addPost = db.prepare('INSERT INTO posts(id,account_id,caption,kind,created_at) VALUES(?,?,?,?,?)');
    for (let i = 0; i < 28; i++) {
      const account = accounts[hash(i * 37 + 12) % accounts.length];
      addPost.run(randomUUID(), account.id, choose(captions, i * 9 + 8), 'post', new Date(Date.now() - i * 3600000).toISOString());
    }
    const addStory = db.prepare('INSERT INTO posts(id,account_id,caption,kind,created_at,expires_at) VALUES(?,?,?,?,?,?)');
    for (let i = 0; i < 12; i++) {
      const account = accounts[hash(i * 29 + 6) % accounts.length];
      addStory.run(randomUUID(), account.id, choose(captions, i * 5 + 31), 'story', now,
        new Date(Date.now() + 24 * 3600000).toISOString());
    }
    logEvent(db, HUMAN_ID, 'population.seeded', { personas: 100, posts: 28, stories: 12 });
  });

  for (const account of accounts) saveSystemFile(db, account.id, dataRoot);
  return { seeded: true, accounts: 101 };
}

if (import.meta.main) {
  const db = openStore();
  console.log(JSON.stringify(seedStore(db)));
  db.close();
}
