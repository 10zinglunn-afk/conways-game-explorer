import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getTutorialCatalog,
  getTutorialGroups,
  getTutorialsByGroup,
} from './tutorials.js';

test('tutorial catalog includes famous loadable builder lessons', () => {
  const tutorials = getTutorialCatalog();

  assert.equal(tutorials.some((tutorial) => tutorial.patternId === 'gosper-gun'), true);
  assert.equal(tutorials.some((tutorial) => tutorial.title.includes('Simkin')), true);
  assert.equal(tutorials.every((tutorial) => tutorial.sourceUrl), true);
});

test('tutorial groups separate starter, builder, and masterwork lessons', () => {
  assert.deepEqual(getTutorialGroups().map((group) => group.id), [
    'starter',
    'builder',
    'masterworks',
  ]);
  assert.equal(getTutorialsByGroup('starter').some((tutorial) => tutorial.patternId === 'glider'), true);
  assert.equal(getTutorialsByGroup('builder').some((tutorial) => tutorial.patternId === 'gosper-gun'), true);
  assert.equal(getTutorialsByGroup('masterworks').some((tutorial) => tutorial.title.includes('OTCA')), true);
});

test('loadable tutorials include a goal and modification prompt', () => {
  const loadable = getTutorialCatalog().filter((tutorial) => tutorial.patternId);

  assert.equal(loadable.length > 8, true);
  assert.equal(loadable.every((tutorial) => tutorial.goal && tutorial.modifyPrompt), true);
});
