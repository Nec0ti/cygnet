import assert from 'node:assert/strict';
import { createInitialProfiles } from './generate.mjs';

const profiles = createInitialProfiles('self-check');
assert.equal(profiles.length, 100);
assert.equal(profiles.filter(({ country }) => country === 'United States').length, 60);
assert.deepEqual(createInitialProfiles('self-check'), profiles);
for (const profile of profiles) {
  assert.ok(profile.age >= 16 && profile.age <= 30);
  assert.equal(profile.language, 'English');
  assert.match(profile.systemMd, /## Friends/);
  assert.match(profile.systemMd, /## Traits/);
  assert.equal(new Set(profile.friends).size, profile.friends.length);
  assert.ok(!profile.friends.includes(profile.id));
  for (const friendId of profile.friends) {
    const friend = profiles.find(({ id }) => id === friendId);
    assert.ok(friend?.friends.includes(profile.id));
  }
}
console.log('seed self-check passed');
