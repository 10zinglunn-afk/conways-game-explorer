import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getCommunityActionCopy,
  getToolDrawerCopy,
  getWorkspacePresentation,
} from './workspace.js';

test('community is a separate feed surface without live board controls', () => {
  assert.deepEqual(getWorkspacePresentation('community'), {
    mode: 'community',
    activePanel: 'community',
    showsWorld: false,
    showsTransport: false,
    showsPlaygroundTools: false,
    showsDevTools: false,
    showsCommunityTools: true,
  });
});

test('playground keeps the live board and game controls visible', () => {
  assert.equal(getWorkspacePresentation('playground').showsWorld, true);
  assert.equal(getWorkspacePresentation('playground').showsTransport, true);
  assert.equal(getWorkspacePresentation('playground').activePanel, 'playground');
});

test('dev opens as a project launcher before showing the board controls', () => {
  assert.deepEqual(getWorkspacePresentation('dev'), {
    mode: 'dev',
    activePanel: 'dev-start',
    showsWorld: false,
    showsTransport: false,
    showsPlaygroundTools: false,
    showsDevTools: true,
    showsCommunityTools: false,
  });
});

test('dev project mode shows the blank board with universal tools available', () => {
  assert.deepEqual(getWorkspacePresentation('dev', { devProjectActive: true }), {
    mode: 'dev',
    activePanel: 'dev-project',
    showsWorld: true,
    showsTransport: true,
    showsPlaygroundTools: true,
    showsDevTools: true,
    showsCommunityTools: false,
  });
});

test('community cards describe editable copies instead of mutating the shared source', () => {
  assert.deepEqual(getCommunityActionCopy(), {
    play: 'Play',
    edit: 'Edit Clone',
    star: 'Star',
    share: 'Share',
  });
});

test('tool drawer copy separates opening the drawer from closing it', () => {
  assert.deepEqual(getToolDrawerCopy({ open: false }), {
    label: 'Open Tools',
    ariaLabel: 'Open tools drawer',
  });
  assert.deepEqual(getToolDrawerCopy({ open: true }), {
    label: 'Close Tools',
    ariaLabel: 'Close tools drawer',
  });
});
