import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const firstNames = ['Avery', 'Jordan', 'Riley', 'Morgan', 'Casey', 'Taylor', 'Quinn', 'Skyler', 'Maya', 'Noah', 'Lena', 'Ethan', 'Sofia', 'Eli', 'Amara', 'Kai', 'Zoe', 'Miles', 'Nina', 'Leo'];
const lastNames = ['Parker', 'Reed', 'Morgan', 'Hayes', 'Bennett', 'Brooks', 'Carter', 'Foster', 'Gray', 'Kim', 'Rivera', 'Patel', 'Nguyen', 'Kowalski', 'Silva', 'Okafor', 'Tanaka', 'Demir', 'Dubois', 'Müller'];
const countries = ['Canada', 'United Kingdom', 'Mexico', 'Brazil', 'India', 'Japan', 'Nigeria', 'Türkiye', 'Germany', 'France', 'Australia', 'South Korea', 'Italy', 'Spain', 'South Africa', 'Philippines', 'Indonesia', 'Egypt', 'Argentina', 'Sweden'];
const traitNames = ['warmth', 'hostility', 'nerdiness', 'sociability', 'shyness', 'openness', 'impulsivity', 'religiosity', 'flirtiness', 'creativity'];
const pronouns = ['she/her', 'he/him', 'they/them', 'she/they', 'he/they'];
const hobbies = ['street photography', 'indie games', 'running', 'cooking', 'urban gardening', 'live music', 'board games', 'astronomy', 'fashion', 'reading'];

function randomFrom(seed) {
  let state = seed >>> 0;
  return () => {
    state += 0x6D2B79F5;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(seed) {
  if (Number.isInteger(seed)) return seed >>> 0;
  let hash = 2166136261;
  for (const char of String(seed)) hash = Math.imul(hash ^ char.charCodeAt(0), 16777619);
  return hash >>> 0;
}

const choose = (items, random) => items[Math.floor(random() * items.length)];
const slugify = (value) => value.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '.').replace(/^\.|\.$/g, '');

function scheduleFor(traits, random) {
  if (traits.shyness >= 75 && traits.sociability <= 40) {
    return { postMode: random() < 0.55 ? 'story_only' : 'rare_posts', postIntervalHours: random() < 0.55 ? null : 96 + Math.floor(random() * 193), storyIntervalHours: 12 + Math.floor(random() * 37), dmInitiation: 'only_after_contact' };
  }
  if (traits.sociability >= 70) {
    return { postMode: 'frequent', postIntervalHours: 4 + Math.floor(random() * 5), storyIntervalHours: 2 + Math.floor(random() * 11), dmInitiation: 'frequent' };
  }
  return { postMode: 'occasional', postIntervalHours: 24 + Math.floor(random() * 73), storyIntervalHours: 8 + Math.floor(random() * 25), dmInitiation: 'occasional' };
}

function toneFor(traits) {
  const voice = [];
  if (traits.shyness >= 70 || traits.sociability < 30) voice.push('reserved and concise');
  else if (traits.sociability >= 75) voice.push('social and expressive');
  if (traits.warmth >= 70) voice.push('kind and encouraging');
  if (traits.hostility >= 70) voice.push('blunt and argumentative');
  if (traits.nerdiness >= 70) voice.push('analytical and detail-oriented');
  if (traits.creativity >= 70) voice.push('imaginative and playful');
  return voice.length ? `Write in a ${voice.join(', ')} way.` : 'Write casually and adapt to the conversation.';
}

function renderSystemMd(profile) {
  const friendLines = profile.friends.length ? profile.friends.map((id) => `- [[${id}]]`).join('\n') : '- None yet';
  const traits = Object.entries(profile.traits).map(([name, value]) => `- ${name}: ${value}/100`).join('\n');
  const boundaries = profile.age < 18
    ? '\n- You are under 18. Keep conversations age-appropriate; do not engage in sexual or erotic conversation, sexting, or sexual roleplay. Never sexualize adults or minors.'
    : '';
  return `# ${profile.username}\n\n## Voice\n${profile.tone}\n\n## Identity\n- Name: ${profile.name}\n- Age: ${profile.age}\n- Country: ${profile.country}\n- Pronouns: ${profile.pronouns}\n- Language: English only\n\n## Traits\n${traits}\n\n## Friends\n${friendLines}\n\n## Notes\n${profile.notes.map((note) => `- ${note}`).join('\n') || '- None'}\n\n## Activity rhythm\n- Posts: ${profile.activity.postMode}${profile.activity.postIntervalHours ? `, every ${profile.activity.postIntervalHours} hours` : ''}\n- Stories: every ${profile.activity.storyIntervalHours} hours\n- DM initiation: ${profile.activity.dmInitiation}\n\n## Content boundaries\n- Never create sexual imagery for public posts.${boundaries}\n- All posts, comments, and messages must be in English.\n`;
}

export function createInitialProfiles(seed = 'cygnet-v1') {
  const random = randomFrom(hashSeed(seed));
  const profiles = Array.from({ length: 100 }, (_, index) => {
    const id = `u${String(index + 1).padStart(4, '0')}`;
    const name = `${choose(firstNames, random)} ${choose(lastNames, random)}`;
    const username = `${slugify(name).replaceAll('.', '')}${String(index + 1).padStart(2, '0')}`;
    const traits = Object.fromEntries(traitNames.map((trait) => [trait, Math.floor(random() * 101)]));
    const profile = {
      id,
      name,
      username,
      pronouns: choose(pronouns, random),
      age: 16 + Math.floor(random() * 15),
      country: 'United States',
      language: 'English',
      bio: '',
      tone: toneFor(traits),
      traits,
      friends: [],
      notes: [`Enjoys ${choose(hobbies, random)}.`],
      activity: scheduleFor(traits, random),
      systemMd: '',
    };
    return profile;
  });

  // Shuffle origin labels so the exact 60/40 split does not cluster in the list.
  const origins = [...Array(60).fill('United States'), ...Array.from({ length: 40 }, () => choose(countries, random))];
  for (let i = origins.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [origins[i], origins[j]] = [origins[j], origins[i]];
  }
  profiles.forEach((profile, index) => { profile.country = origins[index]; });

  // Random undirected ties make the friend graph bidirectional by construction.
  for (let i = 0; i < profiles.length; i++) {
    for (let j = i + 1; j < profiles.length; j++) {
      const chance = 0.015 + ((profiles[i].traits.sociability + profiles[j].traits.sociability) / 200) * 0.045;
      if (random() < chance) {
        profiles[i].friends.push(profiles[j].id);
        profiles[j].friends.push(profiles[i].id);
      }
    }
  }
  for (const profile of profiles) profile.systemMd = renderSystemMd(profile);
  return profiles;
}

export async function writeInitialProfiles(rootDir, seed = 'cygnet-v1') {
  const root = path.resolve(rootDir);
  const profiles = createInitialProfiles(seed);
  const personaDir = path.join(root, 'personas');
  await mkdir(personaDir, { recursive: true });
  await writeFile(path.join(root, 'profiles.json'), `${JSON.stringify({ version: 1, seed: String(seed), profiles: profiles.map(({ systemMd, ...profile }) => profile) }, null, 2)}\n`, { flag: 'wx' });
  for (const { id, systemMd } of profiles) {
    const dir = path.join(personaDir, id);
    await mkdir(dir, { recursive: true });
    await writeFile(path.join(dir, 'system.md'), systemMd, { flag: 'wx' });
  }
  return profiles.length;
}
