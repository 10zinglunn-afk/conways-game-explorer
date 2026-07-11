import {
  cellIndex,
  clearBoard,
  createBoard,
  createRandomBoard,
  getCell,
  getPopulation,
  nextGeneration,
  placePattern,
  wrap,
} from './life.js';
import {
  describeDriftClaim,
  describePeriodClaim,
  describePopulationSnapshot,
} from './dev-tools.js';
import { createCommunityRepository, migrateLocalState } from './community-repository.js';
import { addCreationComment, createRemixTitle } from './community.js';
import { encodeShareLink, decodeShareLink } from './share.js';
import {
  encodeRle,
  getPatternBounds,
  getPresetGroup,
  parseRle,
  transformCoordinates,
} from './patterns.js';
import {
  getStampCta,
  getHapticPattern,
  getLiveToolAction,
  getNextTool,
  getToolAfterWorkspaceChange,
  getToolStatusMessage,
  shouldHideStampPreview,
  getWheelAction,
} from './interaction.js';
import {
  createDesignSettings,
  getDesignSettingSummary,
  mergeDesignSettings,
  serializeDesignSettings,
} from './design-settings.js';
import {
  getCommunityActionCopy,
  getToolDrawerCopy,
  getWorkspacePresentation,
} from './workspace.js';
import {
  getTutorialCatalog,
  getTutorialGroups,
  getPlaygroundIntroSteps,
  getTutorialsByGroup,
} from './tutorials.js';
import { mountLandingIntro } from './landing.js';
import { getPresetStampSummary, presetGroups, presets } from './presets.js';

const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 200;
const LOCAL_RECOVERY_KEY = 'life-logic-dev-recovery-v1';
const BASE_CELL_SIZE = 10;
const MIN_ZOOM = 0.18;
const MAX_ZOOM = 3.6;
const DEFAULT_DESIGN_SETTINGS = createDesignSettings({
  gridPreset: 'medium',
  width: WORLD_WIDTH,
  height: WORLD_HEIGHT,
});
const tutorialGroups = getTutorialGroups();
const tutorialCatalog = getTutorialCatalog();
const playgroundIntroSteps = getPlaygroundIntroSteps();

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false });

const elements = {
  playToggle: document.querySelector('#play-toggle'),
  playLabel: document.querySelector('#play-label'),
  step: document.querySelector('#step'),
  clear: document.querySelector('#clear'),
  randomize: document.querySelector('#randomize'),
  toolDrawerToggle: document.querySelector('#tool-drawer-toggle'),
  toolDrawerLabel: document.querySelector('[data-tool-drawer-label]'),
  toolDrawerClose: document.querySelector('#tool-drawer-close'),
  toolPanel: document.querySelector('#tool-panel'),
  speed: document.querySelector('#speed'),
  speedLabel: document.querySelector('#speed-label'),
  zoom: document.querySelector('#zoom'),
  zoomLabel: document.querySelector('#zoom-label'),
  ageColors: document.querySelector('#age-colors'),
  populationChart: document.querySelector('#population-chart'),
  importRle: document.querySelector('#import-rle'),
  exportRle: document.querySelector('#export-rle'),
  rleField: document.querySelector('#rle-field'),
  patternTabs: document.querySelector('#pattern-tabs'),
  presets: document.querySelector('#presets'),
  presetCount: document.querySelector('#preset-count'),
  stampRotateLeft: document.querySelector('#stamp-rotate-left'),
  stampRotateRight: document.querySelector('#stamp-rotate-right'),
  stampFlip: document.querySelector('#stamp-flip'),
  stampTransformLabel: document.querySelector('#stamp-transform-label'),
  stampOff: document.querySelector('#stamp-off'),
  stampSummary: document.querySelector('#stamp-summary'),
  generation: document.querySelector('#generation'),
  population: document.querySelector('#population'),
  density: document.querySelector('#density'),
  boardSize: document.querySelector('#board-size'),
  activeNote: document.querySelector('#active-note'),
  toolButtons: document.querySelectorAll('[data-tool]'),
  stampLabel: document.querySelector('[data-stamp-label]'),
  feedbackToast: document.querySelector('#feedback-toast'),
  playgroundTutorial: document.querySelector('#playground-tutorial'),
  playgroundTutorialKicker: document.querySelector('#playground-tutorial-kicker'),
  playgroundTutorialTitle: document.querySelector('#playground-tutorial-title'),
  playgroundTutorialBody: document.querySelector('#playground-tutorial-body'),
  playgroundTutorialNext: document.querySelector('#playground-tutorial-next'),
  playgroundTutorialSkip: document.querySelector('#playground-tutorial-skip'),
  introLayer: document.querySelector('#intro-layer'),
  introCanvas: document.querySelector('#intro-canvas'),
  introCardTitle: document.querySelector('#intro-card-title'),
  introHelp: document.querySelector('#intro-help'),
  introProfileFields: document.querySelector('#intro-profile-fields'),
  introName: document.querySelector('#intro-name'),
  introEmail: document.querySelector('#intro-email'),
  introPrompt: document.querySelector('#intro-prompt'),
  introStart: document.querySelector('#intro-start'),
  introSkip: document.querySelector('#intro-skip'),
  playerName: document.querySelector('#player-name'),
  playerMeta: document.querySelector('#player-meta'),
  modePlayground: document.querySelector('#mode-playground'),
  modeDev: document.querySelector('#mode-dev'),
  modeCommunity: document.querySelector('#mode-community'),
  devPanel: document.querySelector('#dev-panel'),
  devOutput: document.querySelector('#dev-output'),
  devDirtyState: document.querySelector('#dev-dirty-state'),
  devProfileName: document.querySelector('#dev-profile-name'),
  devProfileMeta: document.querySelector('#dev-profile-meta'),
  devCreateDesign: document.querySelector('#dev-create-design'),
  devCreateProject: document.querySelector('#dev-create-project'),
  devDesignTitle: document.querySelector('#dev-design-title'),
  devDesignDescription: document.querySelector('#dev-design-description'),
  devDesignTags: document.querySelector('#dev-design-tags'),
  devDesignAttribution: document.querySelector('#dev-design-attribution'),
  devDesignTutorial: document.querySelector('#dev-design-tutorial'),
  devSessionState: document.querySelector('#dev-session-state'),
  devVersionCount: document.querySelector('#dev-version-count'),
  devVersionList: document.querySelector('#dev-version-list'),
  devDesignCount: document.querySelector('#dev-design-count'),
  devDraftCount: document.querySelector('#dev-draft-count'),
  devPublishedCount: document.querySelector('#dev-published-count'),
  devStarredCount: document.querySelector('#dev-starred-count'),
  devProjectList: document.querySelector('#dev-project-list'),
  devGridSummary: document.querySelector('#dev-grid-summary'),
  devStyleSummary: document.querySelector('#dev-style-summary'),
  gridPreset: document.querySelector('#grid-preset'),
  gridWidth: document.querySelector('#grid-width'),
  gridHeight: document.querySelector('#grid-height'),
  applyGridSize: document.querySelector('#apply-grid-size'),
  wrapToggle: document.querySelector('#wrap-toggle'),
  renderStyle: document.querySelector('#render-style'),
  trailIntensity: document.querySelector('#trail-intensity'),
  backgroundColor: document.querySelector('#background-color'),
  gridColor: document.querySelector('#grid-color'),
  liveCellColor: document.querySelector('#live-cell-color'),
  trailCellColor: document.querySelector('#trail-cell-color'),
  accentColor: document.querySelector('#accent-color'),
  selectionColor: document.querySelector('#selection-color'),
  saveDesign: document.querySelector('#save-design'),
  publishDesign: document.querySelector('#publish-design'),
  unpublishDesign: document.querySelector('#unpublish-design'),
  archiveDesign: document.querySelector('#archive-design'),
  deleteDesign: document.querySelector('#delete-design'),
  tutorialGroups: document.querySelector('#tutorial-groups'),
  tutorialList: document.querySelector('#tutorial-list'),
  tutorialCount: document.querySelector('#tutorial-count'),
  tutorialOutput: document.querySelector('#tutorial-output'),
  devComponentButtons: document.querySelectorAll('[data-dev-component]'),
  devDemoButtons: document.querySelectorAll('[data-dev-demo]'),
  devClaimButtons: document.querySelectorAll('[data-dev-claim]'),
  communityPanel: document.querySelector('#community-panel'),
  communityCount: document.querySelector('#community-count'),
  profileName: document.querySelector('#profile-name'),
  profileEmail: document.querySelector('#profile-email'),
  saveProfile: document.querySelector('#save-profile'),
  communityAuth: document.querySelector('#community-auth'),
  communityCloudStatus: document.querySelector('#community-cloud-status'),
  communityAuthEmail: document.querySelector('#community-auth-email'),
  sendMagicLink: document.querySelector('#send-magic-link'),
  communitySignOut: document.querySelector('#community-sign-out'),
  communityAuthOutput: document.querySelector('#community-auth-output'),
  creationTitle: document.querySelector('#creation-title'),
  creationDescription: document.querySelector('#creation-description'),
  creationTags: document.querySelector('#creation-tags'),
  saveCreation: document.querySelector('#save-creation'),
  publishCreation: document.querySelector('#publish-creation'),
  copySharePayload: document.querySelector('#copy-share-payload'),
  communityOutput: document.querySelector('#community-output'),
  communityList: document.querySelector('#community-list'),
  trendingList: document.querySelector('#trending-list'),
  communityFamousList: document.querySelector('#community-famous-list'),
  communityRemixList: document.querySelector('#community-remix-list'),
  communitySearch: document.querySelector('#community-search'),
  communityFilter: document.querySelector('#community-filter'),
  communityFilterButton: document.querySelector('#community-filter-button'),
  communityFilterLabel: document.querySelector('#community-filter-label'),
  communityFilterMenu: document.querySelector('#community-filter-menu'),
  communityFilterOptions: document.querySelectorAll('[data-community-filter-value]'),
  communityDetail: document.querySelector('#community-detail'),
  commentBody: document.querySelector('#comment-body'),
  postComment: document.querySelector('#post-comment'),
  speedStepButtons: document.querySelectorAll('[data-speed-step]'),
  zoomStepButtons: document.querySelectorAll('[data-zoom-step]'),
};

const localCommunity = createCommunityRepository({ backend: 'local' });
let community = localCommunity;
let communityState = community.getState();

const communityRuntimeConfig = getCommunityRuntimeConfig();
const communityAuth = {
  cloudRequested: communityRuntimeConfig.backend === 'supabase',
  cloudConfigured: isSupabaseCommunityConfigured(communityRuntimeConfig),
  cloudRepo: null,
  supabaseClient: null,
  session: null,
  user: null,
  initializing: false,
  sendingLink: false,
  migrating: false,
  migratedUserId: null,
  message: '',
  unsubscribe: null,
};
let feedbackTimer = null;
let recoveryTimer = null;

const state = {
  board: createBoard(DEFAULT_DESIGN_SETTINGS.width, DEFAULT_DESIGN_SETTINGS.height),
  trail: new Uint8Array(DEFAULT_DESIGN_SETTINGS.width * DEFAULT_DESIGN_SETTINGS.height),
  age: new Uint16Array(DEFAULT_DESIGN_SETTINGS.width * DEFAULT_DESIGN_SETTINGS.height),
  populationHistory: [],
  selectedPreset: null,
  stampRotation: 0,
  stampFlipX: false,
  playing: false,
  speed: 10,
  zoom: 1,
  mode: 'playground',
  devProjectActive: false,
  toolDrawerOpen: true,
  playgroundIntroActive: false,
  playgroundIntroIndex: 0,
  playgroundIntroCompleted: false,
  activeDesignSession: null,
  designSettings: DEFAULT_DESIGN_SETTINGS,
  designDirty: false,
  saveStatus: 'saved',
  recoveryFailed: false,
  ageColors: true,
  panX: 0,
  panY: 0,
  tool: 'draw',
  activePresetGroup: presetGroups[0].id,
  activeTutorialGroup: tutorialGroups[0]?.id || 'starter',
  selectedCommunityId: null,
  communitySearch: '',
  communityFilter: 'all',
  communityComments: {},
  pointer: {
    active: false,
    mode: 'draw',
    lastCell: null,
    lastX: 0,
    lastY: 0,
  },
  hoverCell: null,
  lastTick: 0,
  accumulator: 0,
};

const devComponents = {
  glider: {
    name: 'Glider signal',
    note: 'Selected a glider signal. Stamp it on a clear lane, then check drift after four generations.',
    coordinates: findPreset('glider').coordinates,
  },
  'gosper-gun': {
    name: 'Gun source',
    note: 'Selected the Gosper gun. Stamp it with open space to the right and watch the signal stream.',
    coordinates: findPreset('gosper-gun').coordinates,
  },
  eater: {
    name: 'Eater',
    note: 'Selected a stable eater. Place it near a lane to experiment with signal absorption.',
    coordinates: [
      [0, 0],
      [1, 0],
      [0, 1],
      [3, 1],
      [1, 2],
      [3, 2],
      [2, 3],
    ],
  },
  'collision-pair': {
    name: 'Collision pair',
    note: 'Selected two gliders as a collision seed. Use step mode to inspect the interaction.',
    coordinates: findPreset('glider-pair').coordinates,
  },
};

function getCommunityRuntimeConfig() {
  const config = readInlineRuntimeConfig() || window.LIFE_LOGIC_COMMUNITY || {};
  const supabase = config.supabase || {};

  return {
    backend: config.backend || supabase.backend || 'local',
    supabaseUrl: config.supabaseUrl || config.url || config.SUPABASE_URL || supabase.url || supabase.supabaseUrl,
    supabaseAnonKey:
      config.supabaseAnonKey
      || config.anonKey
      || config.anon_key
      || config.key
      || config.SUPABASE_ANON_KEY
      || supabase.anonKey
      || supabase.anon_key
      || supabase.key,
    supabaseModuleUrl:
      config.supabaseModuleUrl
      || config.moduleUrl
      || supabase.moduleUrl
      || 'https://esm.sh/@supabase/supabase-js@2',
    redirectTo: config.redirectTo || window.location.href.split('#')[0],
  };
}

function readInlineRuntimeConfig() {
  const script = document.querySelector('#life-runtime-config');
  const text = script?.textContent?.trim();
  if (!text) return null;

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

function isSupabaseCommunityConfigured(config) {
  return config.backend === 'supabase' && Boolean(config.supabaseUrl && config.supabaseAnonKey);
}

async function initializeCommunityBackend() {
  renderCommunityAuth();

  if (communityAuth.cloudRequested && !communityAuth.cloudConfigured) {
    communityAuth.message = 'Cloud config missing URL or key.';
    renderCommunityAuth();
    return;
  }

  if (!communityAuth.cloudConfigured) return;

  communityAuth.initializing = true;
  communityAuth.message = 'Connecting to cloud...';
  renderCommunityAuth();

  try {
    const client = await createSupabaseClientFromRuntime(communityRuntimeConfig);
    const cloudRepo = createCommunityRepository({ backend: 'supabase', client });
    communityAuth.supabaseClient = client;
    communityAuth.cloudRepo = cloudRepo;
    subscribeCommunityAuth(cloudRepo);

    const session = await readCommunityAuthSession(cloudRepo);
    if (session) {
      await handleCommunityAuthSession(session, { reason: 'initial session' });
    } else {
      communityAuth.message = 'Sign in to publish, star, or clone.';
      renderCommunityAuth();
    }
  } catch (error) {
    community = localCommunity;
    communityState = localCommunity.getState();
    communityAuth.message = `Cloud unavailable: ${getErrorMessage(error)}`;
    renderCommunity();
  } finally {
    communityAuth.initializing = false;
    renderCommunityAuth();
  }
}

async function createSupabaseClientFromRuntime(config) {
  const { createClient } = await import(config.supabaseModuleUrl);

  if (typeof createClient !== 'function') {
    throw new Error('Supabase client module did not export createClient.');
  }

  return createClient(config.supabaseUrl, config.supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: true,
      persistSession: true,
    },
  });
}

function subscribeCommunityAuth(repo) {
  if (typeof communityAuth.unsubscribe === 'function') {
    communityAuth.unsubscribe();
    communityAuth.unsubscribe = null;
  }

  const handleChange = (...args) => {
    const session = normalizeAuthSession(getSessionFromAuthCallback(args));
    handleCommunityAuthSession(session, { reason: 'auth change' }).catch((error) => {
      communityAuth.message = `Auth update failed: ${getErrorMessage(error)}`;
      renderCommunityAuth();
    });
  };

  let subscription = null;
  if (typeof repo.onAuthStateChange === 'function') {
    subscription = repo.onAuthStateChange(handleChange);
  } else if (communityAuth.supabaseClient?.auth?.onAuthStateChange) {
    subscription = communityAuth.supabaseClient.auth.onAuthStateChange((event, session) => {
      handleChange(event, session);
    });
  }

  communityAuth.unsubscribe = getUnsubscribe(subscription);
}

function getSessionFromAuthCallback(args) {
  const [eventOrSession, maybeSession] = args;

  if (maybeSession === null || maybeSession?.user || maybeSession?.access_token) return maybeSession;
  if (eventOrSession === null) return null;
  if (eventOrSession?.session !== undefined) return eventOrSession.session;
  if (eventOrSession?.user || eventOrSession?.access_token) return eventOrSession;

  return null;
}

function getUnsubscribe(subscription) {
  if (typeof subscription === 'function') return subscription;
  if (typeof subscription?.unsubscribe === 'function') return () => subscription.unsubscribe();
  if (typeof subscription?.data?.subscription?.unsubscribe === 'function') {
    return () => subscription.data.subscription.unsubscribe();
  }
  return null;
}

async function readCommunityAuthSession(repo) {
  if (typeof repo?.getAuthSession === 'function') {
    return normalizeAuthSession(await repo.getAuthSession());
  }

  if (communityAuth.supabaseClient?.auth?.getSession) {
    const { data, error } = await communityAuth.supabaseClient.auth.getSession();
    if (error) throw new Error(error.message || 'Could not read auth session.');
    return normalizeAuthSession(data?.session);
  }

  return null;
}

async function readCommunityAuthUser(repo, session) {
  if (typeof repo?.getAuthUser === 'function') {
    return normalizeAuthUser(await repo.getAuthUser());
  }

  if (session?.user) return session.user;

  if (communityAuth.supabaseClient?.auth?.getUser) {
    const { data, error } = await communityAuth.supabaseClient.auth.getUser();
    if (error) throw new Error(error.message || 'Could not read auth user.');
    return normalizeAuthUser(data?.user);
  }

  return null;
}

function normalizeAuthSession(value) {
  if (!value) return null;
  if (value.data?.session !== undefined) return value.data.session;
  if (value.session !== undefined) return value.session;
  return value;
}

function normalizeAuthUser(value) {
  if (!value) return null;
  if (value.data?.user !== undefined) return value.data.user;
  if (value.user !== undefined) return value.user;
  return value;
}

async function handleCommunityAuthSession(session, { reason = '' } = {}) {
  const normalizedSession = normalizeAuthSession(session);

  if (!normalizedSession?.user) {
    communityAuth.session = null;
    communityAuth.user = null;
    communityAuth.migratedUserId = null;
    community = localCommunity;
    communityState = localCommunity.getState();
    if (communityAuth.cloudConfigured && reason) {
      communityAuth.message = 'Signed out. Local drafts active.';
    }
    renderCommunity();
    return;
  }

  communityAuth.session = normalizedSession;
  communityAuth.user = normalizedSession.user;
  await activateCloudCommunity(normalizedSession);
}

async function activateCloudCommunity(session) {
  const repo = communityAuth.cloudRepo;
  if (!repo || communityAuth.migrating) return;

  const user = await readCommunityAuthUser(repo, session);
  communityAuth.user = user || session.user;

  if (communityAuth.migratedUserId === communityAuth.user?.id && community === repo) {
    renderCommunity();
    return;
  }

  communityAuth.migrating = true;
  communityAuth.message = hasLocalCommunityData()
    ? 'Migrating local builds...'
    : 'Syncing cloud profile...';
  renderCommunityAuth();

  try {
    await saveCloudProfileFromLocal(repo, communityAuth.user);
    const migration = await migrateLocalState(localCommunity, repo);
    await repo.loadCommunityState();
    community = repo;
    communityState = community.getState();
    communityAuth.migratedUserId = communityAuth.user?.id || null;
    communityAuth.message = getMigrationMessage(migration);
    renderCommunity();
  } catch (error) {
    community = localCommunity;
    communityState = localCommunity.getState();
    communityAuth.message = `Migration paused: ${getErrorMessage(error)}`;
    elements.communityOutput.textContent = 'Cloud sign-in worked. Local data stayed local.';
    renderCommunity();
  } finally {
    communityAuth.migrating = false;
    renderCommunityAuth();
  }
}

async function saveCloudProfileFromLocal(repo, user) {
  const localState = localCommunity.getState();
  const localProfile = localState.profile;
  const email = localProfile?.email
    || elements.profileEmail.value.trim()
    || elements.communityAuthEmail.value.trim()
    || user?.email
    || '';
  const displayName = localProfile?.displayName
    || elements.profileName.value.trim()
    || getDisplayNameFromEmail(email)
    || 'Life Builder';

  await repo.saveProfile({ email, displayName });
}

function getMigrationMessage(migration) {
  const migratedCount = migration?.migratedCreations?.length || 0;

  if (migratedCount > 0) {
    return `Migrated ${migratedCount} local ${migratedCount === 1 ? 'build' : 'builds'}.`;
  }

  return 'Cloud profile ready.';
}

function hasLocalCommunityData() {
  const localState = localCommunity.getState();
  return Boolean(localState.profile || localState.creations.length > 0);
}

function getDisplayNameFromEmail(email) {
  const [name] = String(email || '').split('@');
  return name ? name.replace(/[._-]+/g, ' ') : '';
}

function isCloudSignedIn() {
  return Boolean(communityAuth.session?.user || communityAuth.user);
}

function isCloudCommunityActive() {
  return communityAuth.cloudConfigured && community === communityAuth.cloudRepo && isCloudSignedIn();
}

function requiresCloudSignInForSharedAction() {
  return communityAuth.cloudConfigured && !isCloudSignedIn();
}

function showSignInRequired(action) {
  const message = `Sign in to ${action} shared builds.`;
  communityAuth.message = message;
  elements.communityOutput.textContent = message;
  renderCommunityAuth();
}

async function sendCommunityMagicLink() {
  if (!communityAuth.cloudConfigured || !communityAuth.cloudRepo) {
    communityAuth.message = 'Cloud is not ready.';
    renderCommunityAuth();
    return;
  }

  const email = (elements.communityAuthEmail.value || elements.profileEmail.value).trim();
  if (!email) {
    communityAuth.message = 'Enter an email for the magic link.';
    renderCommunityAuth();
    return;
  }

  communityAuth.sendingLink = true;
  communityAuth.message = 'Sending magic link...';
  renderCommunityAuth();

  try {
    await sendMagicLinkWithRepository(communityAuth.cloudRepo, email, {
      redirectTo: communityRuntimeConfig.redirectTo,
    });
    communityAuth.message = 'Magic link sent. Check your email.';
  } catch (error) {
    communityAuth.message = `Could not send link: ${getErrorMessage(error)}`;
  } finally {
    communityAuth.sendingLink = false;
    renderCommunityAuth();
  }
}

async function sendMagicLinkWithRepository(repo, email, options) {
  if (typeof repo?.sendMagicLink === 'function') {
    return repo.sendMagicLink(email, options);
  }

  if (communityAuth.supabaseClient?.auth?.signInWithOtp) {
    const { error } = await communityAuth.supabaseClient.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: options.redirectTo },
    });
    if (error) throw new Error(error.message || 'Could not send magic link.');
    return null;
  }

  throw new Error('Magic-link auth is not available.');
}

async function signOutCommunity() {
  if (!communityAuth.cloudConfigured) return;

  try {
    if (typeof communityAuth.cloudRepo?.signOut === 'function') {
      await communityAuth.cloudRepo.signOut();
    } else if (communityAuth.supabaseClient?.auth?.signOut) {
      const { error } = await communityAuth.supabaseClient.auth.signOut();
      if (error) throw new Error(error.message || 'Could not sign out.');
    }
    communityAuth.message = 'Signed out. Local drafts active.';
  } catch (error) {
    communityAuth.message = `Could not sign out: ${getErrorMessage(error)}`;
  } finally {
    communityAuth.session = null;
    communityAuth.user = null;
    communityAuth.migratedUserId = null;
    community = localCommunity;
    communityState = localCommunity.getState();
    renderCommunity();
  }
}

function renderCommunityAuth() {
  if (!elements.communityAuth) return;

  const visible = communityAuth.cloudConfigured || communityAuth.cloudRequested;
  elements.communityAuth.hidden = !visible;
  if (!visible) return;

  const signedIn = isCloudSignedIn();
  const userEmail = communityAuth.user?.email || communityAuth.session?.user?.email || '';

  elements.communityCloudStatus.textContent = getCloudStatusText({ signedIn, userEmail });
  elements.communitySignOut.hidden = !signedIn;
  elements.communitySignOut.disabled = communityAuth.migrating;
  elements.sendMagicLink.disabled = !communityAuth.cloudRepo || communityAuth.sendingLink || communityAuth.migrating || signedIn;
  elements.communityAuthEmail.disabled = signedIn || communityAuth.sendingLink || communityAuth.migrating;
  elements.communityAuthOutput.textContent = communityAuth.message || (signedIn ? 'Cloud active.' : 'Local drafts active.');

  if (!elements.communityAuthEmail.value && document.activeElement !== elements.communityAuthEmail) {
    elements.communityAuthEmail.value = elements.profileEmail.value || userEmail;
  }
}

function getCloudStatusText({ signedIn, userEmail }) {
  if (communityAuth.cloudRequested && !communityAuth.cloudConfigured) return 'Cloud: missing config';
  if (communityAuth.initializing) return 'Cloud: connecting';
  if (communityAuth.migrating) return 'Cloud: migrating';
  if (signedIn) return `Cloud: ${userEmail || 'signed in'}`;
  return 'Cloud: signed out';
}

function getErrorMessage(error) {
  return error instanceof Error ? error.message : String(error || 'Unknown error');
}

function resetBoardStorage(board = state.board) {
  state.trail = new Uint8Array(board.width * board.height);
  state.age = new Uint16Array(board.width * board.height);
  state.populationHistory = [];
}

function replaceBoard(board, { center = false, markEffects = true } = {}) {
  state.board = board;
  resetBoardStorage(board);
  if (markEffects) markLivingCells(230, 1);
  if (center) centerWorld();
  updateStats();
}

function markDesignDirty(dirty = true) {
  state.designDirty = dirty;
  setSaveStatus(dirty ? (navigator.onLine === false ? 'offline' : 'dirty') : 'saved');
  if (dirty) scheduleLocalRecovery();
}

function setSaveStatus(status) {
  const labels = {
    dirty: 'Unsaved',
    saving: 'Saving…',
    saved: 'Saved',
    failed: 'Save failed',
    offline: 'Offline recovery',
  };
  state.saveStatus = status;
  if (elements.devDirtyState) {
    elements.devDirtyState.textContent = labels[status] || labels.saved;
    elements.devDirtyState.classList.toggle('dirty', status === 'dirty' || status === 'offline');
    elements.devDirtyState.classList.toggle('failed', status === 'failed');
  }
}

function scheduleLocalRecovery() {
  window.clearTimeout(recoveryTimer);
  recoveryTimer = window.setTimeout(() => {
    try {
      const coordinates = getLiveCoordinates();
      const recovery = {
        creationId: state.activeDesignSession?.creationId || null,
        title: state.activeDesignSession?.title || elements.devDesignTitle?.value || 'Untitled Design',
        description: elements.devDesignDescription?.value || '',
        tags: elements.devDesignTags?.value || '',
        attribution: elements.devDesignAttribution?.value || '',
        tutorialReference: elements.devDesignTutorial?.value || '',
        rle: encodeRle(coordinates),
        width: state.board.width,
        height: state.board.height,
        generation: state.board.generation,
        population: coordinates.length,
        settings: getCurrentDesignSettings(),
        savedAt: new Date().toISOString(),
      };
      localStorage.setItem(LOCAL_RECOVERY_KEY, JSON.stringify(recovery));
      state.recoveryFailed = false;
    } catch {
      state.recoveryFailed = true;
      setSaveStatus('failed');
    }
  }, 500);
}

function clearLocalRecovery() {
  window.clearTimeout(recoveryTimer);
  recoveryTimer = null;
  try {
    localStorage.removeItem(LOCAL_RECOVERY_KEY);
    state.recoveryFailed = false;
  } catch {
    // A completed repository save is still authoritative if local recovery cleanup fails.
  }
}

function restoreLocalRecovery() {
  try {
    const raw = localStorage.getItem(LOCAL_RECOVERY_KEY);
    if (!raw) return false;
    const recovery = JSON.parse(raw);
    const pattern = parseRle(recovery.rle);
    const settings = createDesignSettings(recovery.settings || {
      gridPreset: 'custom',
      width: recovery.width,
      height: recovery.height,
    });
    const board = placePattern(createBoard(recovery.width, recovery.height), pattern.coordinates, 0, 0);
    board.generation = Number(recovery.generation || 0);
    state.designSettings = settings;
    replaceBoard(board, { center: true });
    state.devProjectActive = true;
    state.activeDesignSession = {
      kind: 'editing',
      creationId: recovery.creationId || null,
      title: recovery.title || 'Recovered Design',
      sourceTitle: '',
      sourceOwnerName: communityState.profile?.displayName || 'Guest Builder',
    };
    setDesignMetadataFields({
      title: recovery.title,
      description: recovery.description,
      tags: recovery.tags,
      attribution: recovery.attribution,
      tutorialReference: recovery.tutorialReference,
    });
    markDesignDirty(true);
    return true;
  } catch {
    return false;
  }
}

function getCurrentDesignSettings() {
  return serializeDesignSettings({
    ...state.designSettings,
    width: state.board.width,
    height: state.board.height,
    speed: state.speed,
    zoom: state.zoom,
    camera: {
      x: Math.round(state.panX),
      y: Math.round(state.panY),
    },
  });
}

function applyDesignSettingsPatch(patch, { resizeBoard = false, dirty = true, center = true } = {}) {
  const previous = state.designSettings;
  const next = mergeDesignSettings(previous, patch);
  const dimensionsChanged = previous.width !== next.width || previous.height !== next.height;

  state.designSettings = next;

  if (resizeBoard || dimensionsChanged) {
    state.board = createBoard(next.width, next.height);
    resetBoardStorage();
    if (center) centerWorld();
    updateStats();
  }

  setSpeed(next.speed);
  setZoom(next.zoom);
  syncDesignControls();
  if (dirty) markDesignDirty(true);
}

function syncDesignControls() {
  const settings = state.designSettings;

  if (elements.gridPreset) elements.gridPreset.value = settings.gridPreset;
  if (elements.gridWidth) elements.gridWidth.value = settings.width;
  if (elements.gridHeight) elements.gridHeight.value = settings.height;
  if (elements.wrapToggle) elements.wrapToggle.checked = settings.wrapping;
  if (elements.renderStyle) elements.renderStyle.value = settings.renderStyle;
  if (elements.trailIntensity) elements.trailIntensity.value = settings.trailIntensity;
  if (elements.backgroundColor) elements.backgroundColor.value = settings.backgroundColor;
  if (elements.gridColor) elements.gridColor.value = settings.gridColor;
  if (elements.liveCellColor) elements.liveCellColor.value = settings.liveCellColor;
  if (elements.trailCellColor) elements.trailCellColor.value = settings.trailCellColor;
  if (elements.accentColor) elements.accentColor.value = settings.accentColor;
  if (elements.selectionColor) elements.selectionColor.value = settings.selectionColor;
  if (elements.devGridSummary) elements.devGridSummary.textContent = `${settings.width} x ${settings.height}`;
  if (elements.devStyleSummary) elements.devStyleSummary.textContent = `${settings.renderStyle} cells`;
}

function syncToolDrawer() {
  const shell = document.querySelector('.app-shell');
  const presentation = getWorkspacePresentation(state.mode, { devProjectActive: state.devProjectActive });
  const drawerControlsPanel = presentation.activePanel === 'playground'
    || presentation.activePanel === 'dev-project';
  const panelUnavailable = drawerControlsPanel && !state.toolDrawerOpen;
  shell.classList.toggle('tools-collapsed', !state.toolDrawerOpen);
  const copy = getToolDrawerCopy({ open: state.toolDrawerOpen });
  if (elements.toolDrawerToggle) {
    elements.toolDrawerToggle.setAttribute('aria-expanded', String(state.toolDrawerOpen));
    elements.toolDrawerToggle.classList.toggle('active', state.toolDrawerOpen);
    elements.toolDrawerToggle.setAttribute('aria-label', copy.ariaLabel);
  }
  if (elements.toolDrawerLabel) {
    elements.toolDrawerLabel.textContent = copy.label;
  }
  if (elements.toolDrawerClose) {
    elements.toolDrawerClose.textContent = copy.label;
    elements.toolDrawerClose.setAttribute('aria-label', copy.ariaLabel);
  }
  if (elements.toolPanel) {
    elements.toolPanel.inert = panelUnavailable;
    elements.toolPanel.setAttribute('aria-hidden', String(panelUnavailable));
  }
  centerWorld();
}

function setToolDrawerOpen(open) {
  state.toolDrawerOpen = open;
  syncToolDrawer();
}

function getTransformedPresetCoordinates() {
  if (!state.selectedPreset) return [];
  return transformCoordinates(state.selectedPreset.coordinates, {
    rotation: state.stampRotation,
    flipX: state.stampFlipX,
  });
}

function updateStampTransformControls() {
  const degrees = ((state.stampRotation % 360) + 360) % 360;
  if (elements.stampTransformLabel) {
    elements.stampTransformLabel.textContent = state.stampFlipX ? `${degrees}° Flip` : `${degrees}°`;
  }
  if (elements.stampFlip) {
    elements.stampFlip.classList.toggle('active', state.stampFlipX);
    elements.stampFlip.setAttribute('aria-pressed', String(state.stampFlipX));
  }
}

function getSelectedPresetStampSummary() {
  return getPresetStampSummary(state.selectedPreset);
}

function updateStampSummary() {
  if (!elements.stampSummary) return;

  if (!state.selectedPreset) {
    elements.stampSummary.hidden = true;
    elements.stampSummary.textContent = '';
    return;
  }

  elements.stampSummary.hidden = false;
  elements.stampSummary.textContent = `${state.selectedPreset.name} · ${getSelectedPresetStampSummary()}`;
}

function turnStampOff() {
  if (state.tool !== 'stamp') return;

  state.hoverCell = null;
  state.pointer.active = false;
  setTool('draw');
  elements.activeNote.textContent = state.selectedPreset
    ? `Stamp off. ${state.selectedPreset.name} stays selected.`
    : 'Stamp off.';
  triggerHaptic('stampToggle');
}

function renderPlaygroundIntro() {
  if (!elements.playgroundTutorial) return;

  const step = playgroundIntroSteps[state.playgroundIntroIndex] || playgroundIntroSteps[0];
  const isLast = state.playgroundIntroIndex >= playgroundIntroSteps.length - 1;
  elements.playgroundTutorial.hidden = !state.playgroundIntroActive;
  elements.playgroundTutorial.classList.toggle('active', state.playgroundIntroActive);
  elements.playgroundTutorialKicker.textContent = `Rule ${state.playgroundIntroIndex + 1} / ${playgroundIntroSteps.length}`;
  elements.playgroundTutorialTitle.textContent = step.title;
  elements.playgroundTutorialBody.textContent = step.body;
  elements.playgroundTutorialNext.textContent = isLast ? 'Play' : 'Next';
}

function openPlaygroundIntro() {
  if (state.playgroundIntroCompleted || playgroundIntroSteps.length === 0) return;
  state.playing = false;
  updatePlayButton();
  state.playgroundIntroActive = true;
  state.playgroundIntroIndex = 0;
  renderPlaygroundIntro();
}

function closePlaygroundIntro() {
  state.playgroundIntroActive = false;
  state.playgroundIntroCompleted = true;
  renderPlaygroundIntro();
  elements.activeNote.textContent = 'Playground ready. Draw cells, stamp patterns, or press Play.';
}

function advancePlaygroundIntro() {
  if (!state.playgroundIntroActive) return;
  if (state.playgroundIntroIndex >= playgroundIntroSteps.length - 1) {
    closePlaygroundIntro();
    return;
  }

  state.playgroundIntroIndex += 1;
  renderPlaygroundIntro();
}

function rotateStamp(delta) {
  state.stampRotation = ((state.stampRotation + delta) % 360 + 360) % 360;
  updateStampTransformControls();
  elements.activeNote.textContent = `Stamp rotation ${state.stampRotation}°.`;
}

function flipStamp() {
  state.stampFlipX = !state.stampFlipX;
  updateStampTransformControls();
  elements.activeNote.textContent = state.stampFlipX ? 'Stamp flip on.' : 'Stamp flip off.';
}

function getActiveDesignStatusText() {
  const session = state.activeDesignSession;
  if (!session) return '';

  if (session.kind === 'playing') {
    return `Playing ${session.sourceOwnerName}'s design: ${session.sourceTitle}.`;
  }

  if (session.sourceTitle) {
    return `Editing ${session.title}, your version of ${session.sourceOwnerName}'s ${session.sourceTitle}.`;
  }

  return `Editing ${session.title}.`;
}

function setDesignTitle(title) {
  const cleanTitle = String(title || '').trim();
  const nextTitle = cleanTitle || 'Untitled design';
  if (elements.devDesignTitle && document.activeElement !== elements.devDesignTitle) {
    elements.devDesignTitle.value = nextTitle;
  }
  if (elements.creationTitle && document.activeElement !== elements.creationTitle) {
    elements.creationTitle.value = nextTitle;
  }
  if (state.activeDesignSession) {
    state.activeDesignSession.title = nextTitle;
  }
}

function setDesignMetadataFields({
  title,
  description = '',
  tags = [],
  attribution = '',
  tutorialReference = '',
} = {}) {
  setDesignTitle(title);
  const tagText = Array.isArray(tags) ? tags.join(', ') : String(tags || '');
  if (elements.devDesignDescription && document.activeElement !== elements.devDesignDescription) {
    elements.devDesignDescription.value = description || '';
  }
  if (elements.devDesignTags && document.activeElement !== elements.devDesignTags) {
    elements.devDesignTags.value = tagText;
  }
  if (elements.devDesignAttribution && document.activeElement !== elements.devDesignAttribution) {
    elements.devDesignAttribution.value = attribution || '';
  }
  if (elements.devDesignTutorial && document.activeElement !== elements.devDesignTutorial) {
    elements.devDesignTutorial.value = tutorialReference || '';
  }
  if (elements.creationDescription && document.activeElement !== elements.creationDescription) {
    elements.creationDescription.value = description || '';
  }
  if (elements.creationTags && document.activeElement !== elements.creationTags) {
    elements.creationTags.value = tagText;
  }
}

function startDevProject(kind = 'design', {
  title = '',
  creationId = null,
  source = null,
  boardLoaded = false,
  openTools = false,
} = {}) {
  const player = communityState.profile?.displayName || 'Guest Builder';
  const sessionTitle = title || (kind === 'project' ? 'Untitled Project' : 'Untitled Design');
  state.devProjectActive = true;
  state.toolDrawerOpen = openTools;
  state.activeDesignSession = source
    ? {
      kind: 'editing',
      creationId,
      title: sessionTitle,
      sourceTitle: source.title,
      sourceOwnerName: source.ownerName,
    }
    : {
      kind: 'editing',
      creationId,
      title: sessionTitle,
      sourceTitle: '',
      sourceOwnerName: player,
    };

  if (!boardLoaded) {
    replaceBoard(createBoard(state.designSettings.width, state.designSettings.height), { center: true, markEffects: false });
    markDesignDirty(false);
  }

  setDesignMetadataFields({ title: sessionTitle, description: '', tags: [] });
  setMode('dev');
  syncToolDrawer();
  elements.activeNote.textContent = source
    ? `Editing ${sessionTitle}, cloned from ${source.ownerName}'s ${source.title}.`
    : `${sessionTitle} is a blank slate. Open Tools for stamps, tutorials, grid, and rotators.`;
}

function triggerHaptic(action) {
  const pattern = getHapticPattern(action);
  if (pattern.length > 0) navigator.vibrate?.(pattern);
}

function showToast(message, { kind = 'info' } = {}) {
  if (!elements.feedbackToast) return;

  window.clearTimeout(feedbackTimer);
  elements.feedbackToast.textContent = message;
  elements.feedbackToast.dataset.kind = kind;
  elements.feedbackToast.classList.add('visible');
  feedbackTimer = window.setTimeout(() => {
    elements.feedbackToast.classList.remove('visible');
  }, 1800);
}

function resizeCanvas() {
  const pixelRatio = window.devicePixelRatio || 1;
  const width = window.innerWidth;
  const height = window.innerHeight;
  canvas.width = Math.floor(width * pixelRatio);
  canvas.height = Math.floor(height * pixelRatio);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);
}

function centerWorld() {
  const cellSize = getCellSize();
  const viewport = getWorldViewport();
  state.panX = viewport.left + (viewport.width - state.board.width * cellSize) / 2;
  state.panY = viewport.top + (viewport.height - state.board.height * cellSize) / 2;
}

function getWorldViewport() {
  const presentation = getWorkspacePresentation(state.mode, { devProjectActive: state.devProjectActive });
  const compact = window.innerWidth <= 760;
  const railWidth = compact ? 0 : 270;
  const drawerVisible = state.toolDrawerOpen
    && (presentation.activePanel === 'playground' || presentation.activePanel === 'dev-project');
  const panelWidth = drawerVisible && window.innerWidth > 980 ? 380 : 0;
  const margin = compact ? 12 : 18;
  const left = railWidth + margin;
  const right = panelWidth + margin;
  const top = compact ? 138 : 84;
  const bottom = compact ? 190 : margin;

  return {
    left,
    top,
    width: Math.max(160, window.innerWidth - left - right),
    height: Math.max(160, window.innerHeight - top - bottom),
  };
}

function getCellSize() {
  return BASE_CELL_SIZE * state.zoom;
}

function screenToCell(clientX, clientY) {
  const cellSize = getCellSize();
  return {
    x: Math.floor((clientX - state.panX) / cellSize),
    y: Math.floor((clientY - state.panY) / cellSize),
  };
}

function setZoom(nextZoom, anchorX = window.innerWidth / 2, anchorY = window.innerHeight / 2) {
  const previousCellSize = getCellSize();
  const worldX = (anchorX - state.panX) / previousCellSize;
  const worldY = (anchorY - state.panY) / previousCellSize;

  state.zoom = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, nextZoom));

  const nextCellSize = getCellSize();
  state.panX = anchorX - worldX * nextCellSize;
  state.panY = anchorY - worldY * nextCellSize;
  elements.zoom.value = Math.round(state.zoom * 100);
  elements.zoomLabel.textContent = `${Math.round(state.zoom * 100)}%`;
}

function setSpeed(nextSpeed) {
  state.speed = Math.min(40, Math.max(1, nextSpeed));
  elements.speed.value = state.speed;
  elements.speedLabel.textContent = `${state.speed} gen/s`;
}

function paintCell(cellX, cellY, alive) {
  if (!state.designSettings.wrapping && (
    cellX < 0 || cellY < 0 || cellX >= state.board.width || cellY >= state.board.height
  )) {
    return;
  }

  const x = wrap(cellX, state.board.width);
  const y = wrap(cellY, state.board.height);
  const index = cellIndex(state.board, x, y);
  const nextValue = alive ? 1 : 0;

  if (state.board.cells[index] === nextValue) return;

  state.board.cells[index] = nextValue;
  state.trail[index] = alive ? 255 : 120;
  state.age[index] = alive ? Math.max(state.age[index], 1) : 0;
  markDesignDirty(true);
  updateStats();
}

function applyToolAt(clientX, clientY) {
  const cell = screenToCell(clientX, clientY);
  const key = `${wrap(cell.x, state.board.width)},${wrap(cell.y, state.board.height)}`;

  if (state.pointer.lastCell === key) return;

  if (state.pointer.mode === 'draw') paintCell(cell.x, cell.y, true);
  if (state.pointer.mode === 'erase') paintCell(cell.x, cell.y, false);
  if (state.pointer.mode === 'stamp') {
    stampPattern(cell.x, cell.y);
  }

  state.pointer.lastCell = key;
}

function getCellAliveAt(clientX, clientY) {
  const cell = screenToCell(clientX, clientY);
  return getCell(state.board, cell.x, cell.y);
}

function stampPattern(cellX, cellY) {
  if (!state.selectedPreset) {
    elements.activeNote.textContent = getToolStatusMessage({ tool: 'stamp' });
    return;
  }

  const coordinates = getTransformedPresetCoordinates();
  const bounds = getPatternBounds(coordinates);
  const originX = cellX - Math.floor(bounds.width / 2);
  const originY = cellY - Math.floor(bounds.height / 2);

  state.board = placePatternForCurrentSettings(state.board, coordinates, originX, originY);
  markLivingCells(255, 1);
  elements.activeNote.textContent = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: state.selectedPreset.name,
    stampSummary: getSelectedPresetStampSummary(),
  });
  triggerHaptic('stampPlace');
  showToast(`Stamped ${state.selectedPreset.name}`, { kind: 'success' });
  markDesignDirty(true);
  updateStats();
}

function placePatternForCurrentSettings(board, coordinates, originX, originY) {
  if (state.designSettings.wrapping) {
    return placePattern(board, coordinates, originX, originY);
  }

  const next = {
    ...board,
    cells: new Uint8Array(board.cells),
  };

  for (const [patternX, patternY] of coordinates) {
    const x = originX + patternX;
    const y = originY + patternY;
    if (x < 0 || y < 0 || x >= board.width || y >= board.height) continue;
    next.cells[y * board.width + x] = 1;
  }

  return next;
}

function selectPreset(preset) {
  state.selectedPreset = preset;
  setTool('stamp');
  updatePresetSelection();
  updateStampSummary();
  elements.activeNote.textContent = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: preset.name,
    stampSummary: getSelectedPresetStampSummary(),
  });
  triggerHaptic('stampToggle');
}

function stepSimulation() {
  const previousCells = state.board.cells;
  const next = nextGeneration(state.board, { wrapping: state.designSettings.wrapping });

  for (let i = 0; i < state.trail.length; i += 1) {
    if (next.cells[i]) {
      state.trail[i] = previousCells[i] ? Math.max(state.trail[i], 210) : 255;
      state.age[i] = previousCells[i] ? Math.min(state.age[i] + 1, 1200) : 1;
    } else if (previousCells[i]) {
      state.trail[i] = Math.max(state.trail[i], 140);
      state.age[i] = 0;
    } else {
      state.trail[i] = Math.floor(state.trail[i] * 0.84);
      state.age[i] = 0;
    }
  }

  state.board = next;
  updateStats();
}

function loadPreset(preset) {
  const nextBoard = clearBoard(state.board);
  const bounds = getPatternBounds(preset.coordinates);
  const originX = Math.floor(state.board.width / 2 - bounds.width / 2);
  const originY = Math.floor(state.board.height / 2 - bounds.height / 2);

  state.board = placePattern(nextBoard, preset.coordinates, originX, originY);
  state.selectedPreset = preset;
  resetCellEffects();
  markLivingCells(255, 1);

  elements.activeNote.textContent = preset.note;
  updateStats();
  updatePresetSelection();
  updateStampSummary();
}

function randomSoup() {
  state.board = createRandomBoard(state.board.width, state.board.height, 0.18);
  resetCellEffects();
  markLivingCells(230, 1);

  elements.activeNote.textContent = 'Random soup: turbulence first, then islands, oscillators, and debris.';
  markDesignDirty(true);
  updateStats();
}

function clearWorld() {
  state.board = clearBoard(state.board);
  resetCellEffects();
  elements.activeNote.textContent = 'Blank board ready. Draw cells, drag in a pattern, then press Play.';
  markDesignDirty(true);
  updateStats();
}

function importRle() {
  try {
    const pattern = parseRle(elements.rleField.value);

    state.selectedPreset = {
      id: 'rle-clipboard',
      name: 'RLE clipboard',
      note: `RLE loaded (${pattern.width} x ${pattern.height}). Stamp stays active for repeated placement.`,
      coordinates: pattern.coordinates,
    };
    setTool('stamp');
    updatePresetSelection();
    updateStampSummary();
    elements.activeNote.textContent = getToolStatusMessage({
      tool: 'stamp',
      selectedPresetName: state.selectedPreset.name,
      stampSummary: getSelectedPresetStampSummary(),
    });
    triggerHaptic('stampToggle');
  } catch (error) {
    elements.activeNote.textContent = error instanceof Error ? error.message : 'Could not import that RLE pattern.';
  }
}

function exportRle() {
  const coordinates = getLiveCoordinates();

  elements.rleField.value = encodeRle(coordinates);
  elements.activeNote.textContent = `Exported ${coordinates.length.toLocaleString()} live cells as RLE.`;
  showToast('RLE exported', { kind: 'success' });
}

function getLiveCoordinates() {
  const coordinates = [];

  for (let y = 0; y < state.board.height; y += 1) {
    for (let x = 0; x < state.board.width; x += 1) {
      if (getCell(state.board, x, y)) coordinates.push([x, y]);
    }
  }

  return coordinates;
}

function resetCellEffects() {
  state.trail.fill(0);
  state.age.fill(0);
  state.populationHistory = [];
}

function markLivingCells(trail = 230, age = 1) {
  for (let i = 0; i < state.board.cells.length; i += 1) {
    if (state.board.cells[i]) {
      state.trail[i] = Math.max(state.trail[i], trail);
      state.age[i] = Math.max(state.age[i], age);
    }
  }
}

function render() {
  const width = window.innerWidth;
  const height = window.innerHeight;
  const cellSize = getCellSize();
  const worldWidth = state.board.width * cellSize;
  const worldHeight = state.board.height * cellSize;

  ctx.fillStyle = state.designSettings.backgroundColor;
  ctx.fillRect(0, 0, width, height);

  const gradient = ctx.createRadialGradient(width * 0.5, height * 0.45, 0, width * 0.5, height * 0.45, Math.max(width, height));
  gradient.addColorStop(0, rgbaFromHex(state.designSettings.liveCellColor, 0.12));
  gradient.addColorStop(0.48, rgbaFromHex(state.designSettings.backgroundColor, 0.88));
  gradient.addColorStop(1, '#05070c');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  ctx.translate(state.panX, state.panY);

  ctx.fillStyle = state.designSettings.backgroundColor;
  ctx.fillRect(0, 0, worldWidth, worldHeight);

  drawGrid(cellSize, worldWidth, worldHeight);
  drawCells(cellSize);
  drawStampPreview(cellSize);

  ctx.strokeStyle = 'rgba(148, 163, 184, 0.35)';
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, worldWidth - 1, worldHeight - 1);

  ctx.restore();

  drawTorusHints(width, height);
}

function drawGrid(cellSize, worldWidth, worldHeight) {
  if (cellSize < 5) return;

  const alpha = Math.min(0.28, Math.max(0.08, (cellSize - 3) / 58));
  ctx.strokeStyle = rgbaFromHex(state.designSettings.gridColor, alpha);
  ctx.lineWidth = 1;
  ctx.beginPath();

  const startX = Math.max(0, Math.floor(-state.panX / cellSize) - 1);
  const endX = Math.min(state.board.width, Math.ceil((window.innerWidth - state.panX) / cellSize) + 1);
  const startY = Math.max(0, Math.floor(-state.panY / cellSize) - 1);
  const endY = Math.min(state.board.height, Math.ceil((window.innerHeight - state.panY) / cellSize) + 1);

  for (let x = startX; x <= endX; x += 1) {
    const px = x * cellSize;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, worldHeight);
  }

  for (let y = startY; y <= endY; y += 1) {
    const py = y * cellSize;
    ctx.moveTo(0, py);
    ctx.lineTo(worldWidth, py);
  }

  ctx.stroke();

  ctx.strokeStyle = rgbaFromHex(state.designSettings.accentColor, Math.min(0.24, alpha + 0.07));
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = Math.max(0, Math.ceil(startX / 10) * 10); x <= endX; x += 10) {
    const px = x * cellSize;
    ctx.moveTo(px, 0);
    ctx.lineTo(px, worldHeight);
  }

  for (let y = Math.max(0, Math.ceil(startY / 10) * 10); y <= endY; y += 10) {
    const py = y * cellSize;
    ctx.moveTo(0, py);
    ctx.lineTo(worldWidth, py);
  }

  ctx.stroke();
}

function drawCells(cellSize) {
  const inset = cellSize > 8 ? 1 : 0;
  const startX = Math.max(0, Math.floor(-state.panX / cellSize) - 1);
  const endX = Math.min(state.board.width, Math.ceil((window.innerWidth - state.panX) / cellSize) + 1);
  const startY = Math.max(0, Math.floor(-state.panY / cellSize) - 1);
  const endY = Math.min(state.board.height, Math.ceil((window.innerHeight - state.panY) / cellSize) + 1);

  for (let y = startY; y < endY; y += 1) {
    for (let x = startX; x < endX; x += 1) {
      const index = y * state.board.width + x;
      const trail = state.trail[index];
      const alive = state.board.cells[index] === 1;

      if (!alive && (trail < 8 || state.designSettings.trailIntensity === 'off')) continue;

      if (alive) {
        const color = getAliveColor(state.age[index], trail);
        ctx.shadowColor = color.shadow;
        ctx.shadowBlur = state.designSettings.renderStyle === 'glow' && cellSize > 5
          ? Math.min(22, cellSize * 1.2)
          : Math.min(10, cellSize * 0.5);
        ctx.fillStyle = color.fill;
      } else {
        ctx.shadowBlur = 0;
        const trailFactor = getTrailFactor();
        ctx.fillStyle = rgbaFromHex(state.designSettings.trailCellColor, Math.min(0.48, (trail / 760) * trailFactor));
      }

      drawCellShape(
        x * cellSize + inset,
        y * cellSize + inset,
        Math.max(1, cellSize - inset * 2),
        state.designSettings.renderStyle,
      );
    }
  }

  ctx.shadowBlur = 0;
}

function drawCellShape(x, y, size, style) {
  if (style === 'dot') {
    ctx.beginPath();
    ctx.arc(x + size / 2, y + size / 2, Math.max(1, size * 0.34), 0, Math.PI * 2);
    ctx.fill();
    return;
  }

  if (style === 'rounded') {
    drawRoundedRect(x, y, size, size, Math.min(4, size * 0.28));
    ctx.fill();
    return;
  }

  ctx.fillRect(x, y, size, size);
}

function drawRoundedRect(x, y, width, height, radius) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

function getTrailFactor() {
  const factors = {
    low: 0.55,
    medium: 1,
    high: 1.65,
  };

  return factors[state.designSettings.trailIntensity] || 0;
}

function rgbaFromHex(hex, alpha) {
  const normalized = String(hex || '#000000').replace('#', '');
  const value = /^[0-9a-f]{6}$/i.test(normalized) ? normalized : '000000';
  const red = Number.parseInt(value.slice(0, 2), 16);
  const green = Number.parseInt(value.slice(2, 4), 16);
  const blue = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${red}, ${green}, ${blue}, ${alpha})`;
}

function drawStampPreview(cellSize) {
  if (state.tool !== 'stamp' || !state.selectedPreset || !state.hoverCell) return;

  const coordinates = getTransformedPresetCoordinates();
  const bounds = getPatternBounds(coordinates);
  const originX = state.hoverCell.x - Math.floor(bounds.width / 2);
  const originY = state.hoverCell.y - Math.floor(bounds.height / 2);
  const inset = cellSize > 8 ? 1 : 0;

  ctx.save();
  ctx.shadowColor = 'rgba(94, 234, 212, 0.52)';
  ctx.shadowBlur = Math.min(18, cellSize);
  ctx.fillStyle = 'rgba(191, 253, 244, 0.28)';
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.72)';
  ctx.lineWidth = Math.max(1, Math.min(2, cellSize * 0.12));

  for (const [patternX, patternY] of coordinates) {
    const x = wrap(originX + patternX, state.board.width);
    const y = wrap(originY + patternY, state.board.height);
    const px = x * cellSize + inset;
    const py = y * cellSize + inset;
    const size = Math.max(1, cellSize - inset * 2);

    ctx.fillRect(px, py, size, size);
    if (cellSize > 6) ctx.strokeRect(px + 0.5, py + 0.5, size - 1, size - 1);
  }

  ctx.restore();
}

function getAliveColor(age, trail) {
  if (!state.ageColors) {
    return {
      fill: trail > 245 ? state.designSettings.selectionColor : state.designSettings.liveCellColor,
      shadow: rgbaFromHex(state.designSettings.liveCellColor, 0.58),
    };
  }

  if (age <= 2 || trail > 248) {
    return {
      fill: state.designSettings.selectionColor,
      shadow: rgbaFromHex(state.designSettings.selectionColor, 0.72),
    };
  }

  if (age < 12) {
    return {
      fill: state.designSettings.liveCellColor,
      shadow: rgbaFromHex(state.designSettings.liveCellColor, 0.58),
    };
  }

  if (age < 60) {
    return {
      fill: state.designSettings.trailCellColor,
      shadow: rgbaFromHex(state.designSettings.trailCellColor, 0.46),
    };
  }

  return {
    fill: state.designSettings.accentColor,
    shadow: rgbaFromHex(state.designSettings.accentColor, 0.42),
  };
}

function drawTorusHints(width, height) {
  ctx.save();
  ctx.fillStyle = 'rgba(148, 163, 184, 0.55)';
  ctx.font = '12px ui-monospace, SFMono-Regular, Menlo, monospace';
  ctx.fillText(
    state.designSettings.wrapping
      ? 'wrapped edges: north touches south, west touches east'
      : 'bounded edges: cells outside the board stay dead',
    24,
    height - 24,
  );
  ctx.restore();
}

function drawPopulationChart() {
  const chart = elements.populationChart;
  const chartCtx = chart.getContext('2d');
  const width = chart.width;
  const height = chart.height;
  const points = state.populationHistory;

  chartCtx.clearRect(0, 0, width, height);
  chartCtx.fillStyle = 'rgba(3, 7, 18, 0.82)';
  chartCtx.fillRect(0, 0, width, height);

  chartCtx.strokeStyle = 'rgba(148, 163, 184, 0.12)';
  chartCtx.lineWidth = 1;
  chartCtx.beginPath();
  for (let x = 0; x <= width; x += width / 4) {
    chartCtx.moveTo(x, 0);
    chartCtx.lineTo(x, height);
  }
  for (let y = 0; y <= height; y += height / 4) {
    chartCtx.moveTo(0, y);
    chartCtx.lineTo(width, y);
  }
  chartCtx.stroke();

  if (points.length < 2) return;

  const maxPopulation = Math.max(...points.map(({ population }) => population), 1);
  chartCtx.strokeStyle = '#5eead4';
  chartCtx.lineWidth = 2;
  chartCtx.beginPath();

  points.forEach(({ population }, index) => {
    const x = (index / (points.length - 1)) * (width - 12) + 6;
    const y = height - 8 - (population / maxPopulation) * (height - 16);

    if (index === 0) chartCtx.moveTo(x, y);
    else chartCtx.lineTo(x, y);
  });

  chartCtx.stroke();

  chartCtx.fillStyle = 'rgba(94, 234, 212, 0.12)';
  chartCtx.lineTo(width - 6, height - 8);
  chartCtx.lineTo(6, height - 8);
  chartCtx.closePath();
  chartCtx.fill();
}

function updateStats() {
  const population = getPopulation(state.board);
  const density = population / state.board.cells.length;
  const previous = state.populationHistory[state.populationHistory.length - 1];

  if (previous?.generation === state.board.generation) {
    previous.population = population;
  } else {
    state.populationHistory.push({ generation: state.board.generation, population });
    if (state.populationHistory.length > 160) state.populationHistory.shift();
  }

  elements.generation.textContent = state.board.generation.toLocaleString();
  elements.population.textContent = population.toLocaleString();
  elements.density.textContent = `${(density * 100).toFixed(2)}%`;
  elements.boardSize.textContent = `${state.board.width} x ${state.board.height}`;
  drawPopulationChart();
}

function updatePlayButton() {
  elements.playLabel.textContent = state.playing ? 'Pause' : 'Play';
  elements.playToggle.querySelector('.button-icon').textContent = state.playing ? 'Ⅱ' : '▶';
  elements.playToggle.setAttribute('aria-label', state.playing ? 'Pause simulation' : 'Play simulation');
}

function setTool(tool) {
  state.tool = tool;
  const shell = document.querySelector('.app-shell');
  shell.classList.toggle('stamp-mode', tool === 'stamp');
  shell.classList.toggle('pan-mode', tool === 'pan');

  for (const button of elements.toolButtons) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-checked', String(active));

    if (button.dataset.tool === 'stamp') {
      const label = button.querySelector('[data-stamp-label]');
      const cta = getStampCta({ active });
      if (label) label.textContent = active ? 'Stamp on' : cta.label;
      button.setAttribute('aria-label', cta.ariaLabel);
      button.title = active ? 'Stamp mode is on. Use Turn Stamp Off when you are done.' : cta.ariaLabel;
      button.classList.toggle('danger-ready', cta.tone === 'danger');
    }
  }

  if (elements.stampOff) {
    const cta = getStampCta({ active: tool === 'stamp' });
    elements.stampOff.hidden = tool !== 'stamp';
    elements.stampOff.textContent = cta.label;
    elements.stampOff.setAttribute('aria-label', cta.ariaLabel);
  }
  updateStampSummary();
}

function chooseTool(requestedTool) {
  const wasHidingStamp = shouldHideStampPreview({
    currentTool: state.tool,
    requestedTool,
  });
  if (wasHidingStamp) {
    turnStampOff();
    return;
  }

  const nextTool = getNextTool({
    currentTool: state.tool,
    requestedTool,
  });

  setTool(nextTool);

  if (nextTool === 'stamp') {
    elements.activeNote.textContent = getToolStatusMessage({
      tool: 'stamp',
      selectedPresetName: state.selectedPreset?.name,
      stampSummary: getSelectedPresetStampSummary(),
    });
    triggerHaptic('stampToggle');
  } else if (nextTool === 'pan') {
    elements.activeNote.textContent = getToolStatusMessage({ tool: 'pan' });
  } else {
    elements.activeNote.textContent = getToolStatusMessage({ tool: 'draw' });
  }
}

function setMode(mode) {
  const previousMode = state.mode;
  const presentation = getWorkspacePresentation(mode, { devProjectActive: state.devProjectActive });
  state.mode = presentation.mode;
  const devMode = presentation.mode === 'dev';
  const communityMode = presentation.mode === 'community';
  const playgroundMode = presentation.mode === 'playground';
  const devProjectMode = presentation.activePanel === 'dev-project';
  const devStartMode = presentation.activePanel === 'dev-start';

  if (!playgroundMode && state.playgroundIntroActive) {
    state.playgroundIntroActive = false;
    renderPlaygroundIntro();
  }

  if (previousMode !== presentation.mode) {
    const nextTool = getToolAfterWorkspaceChange({ currentTool: state.tool });
    if (nextTool !== state.tool) {
      state.hoverCell = null;
      state.pointer.active = false;
      setTool(nextTool);
    }
  }

  const shell = document.querySelector('.app-shell');
  shell.classList.toggle('playground-mode', playgroundMode);
  shell.classList.toggle('dev-mode', devMode);
  shell.classList.toggle('dev-start-mode', devStartMode);
  shell.classList.toggle('dev-active-mode', devProjectMode);
  shell.classList.toggle('community-mode', communityMode);
  shell.classList.toggle('world-hidden', !presentation.showsWorld);
  shell.classList.toggle('profile-needed', devMode && !communityState.profile);
  elements.modePlayground.classList.toggle('active', playgroundMode);
  elements.modeDev.classList.toggle('active', devMode);
  elements.modeCommunity.classList.toggle('active', communityMode);
  elements.modePlayground.setAttribute('aria-current', playgroundMode ? 'page' : 'false');
  elements.modeDev.setAttribute('aria-current', devMode ? 'page' : 'false');
  elements.modeCommunity.setAttribute('aria-current', communityMode ? 'page' : 'false');

  if (devMode) {
    renderDevStudio();
    elements.activeNote.textContent = devProjectMode
      ? getActiveDesignStatusText()
      : 'Dev Studio: create a new design or project to open a blank board.';
    if (!communityState.profile && devStartMode) {
      elements.devOutput.textContent = 'Create a profile to save drafts, publish designs, and keep remix lineage.';
      window.setTimeout(() => elements.profileName?.focus({ preventScroll: true }), 80);
    }
  } else if (communityMode) {
    if (state.playing) {
      state.playing = false;
      updatePlayButton();
    }
    renderCommunity();
    elements.activeNote.textContent = 'Community Mode: save this board, publish it, clone builds, and watch what trends.';
  } else {
    elements.activeNote.textContent = getActiveDesignStatusText()
      || 'Playground Mode: explore, draw, stamp presets, and watch the world evolve.';
  }

  syncToolDrawer();
}

function selectDevComponent(componentId) {
  const component = devComponents[componentId];

  if (!component) return;

  state.selectedPreset = {
    id: `dev-${componentId}`,
    name: component.name,
    note: component.note,
    coordinates: component.coordinates,
  };
  setTool('stamp');
  updatePresetSelection();
  updateStampSummary();
  elements.devOutput.textContent = `${component.name} ready. Stamp is on for repeated placement.`;
  elements.activeNote.textContent = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: component.name,
    stampSummary: getSelectedPresetStampSummary(),
  });
  triggerHaptic('stampToggle');
}

function runDevDemo(demo) {
  const demoMessages = {
    and: 'AND demo: use two signal lanes and check the output only when both arrive. First build block: stamp two Signals, then a Collide target.',
    or: 'OR demo: either input lane may produce output. First build block: stamp two Signals aimed toward one output lane.',
    xor: 'XOR demo: one input gives output; two inputs cancel or redirect. Use Collision Pair as the starter seed.',
    adder: 'Adder plan: half-adder needs XOR for sum and AND for carry. Build XOR and AND demos first, then wire their outputs.',
  };

  if (demo === 'and' || demo === 'or') selectDevComponent('glider');
  if (demo === 'xor') selectDevComponent('collision-pair');
  if (demo === 'adder') selectDevComponent('gosper-gun');

  elements.devOutput.textContent = demoMessages[demo] || 'Choose a logic demo.';
}

function runDevClaim(claim) {
  if (claim === 'period') {
    elements.devOutput.textContent = describePeriodClaim(state.board);
  }

  if (claim === 'drift') {
    elements.devOutput.textContent = describeDriftClaim(state.board);
  }

  if (claim === 'population') {
    elements.devOutput.textContent = describePopulationSnapshot(state.board);
  }
}

async function saveLocalProfile() {
  const email = elements.profileEmail.value;
  const displayName = elements.profileName.value;

  if (!email.trim() || !displayName.trim()) {
    elements.communityOutput.textContent = 'Add a display name and email before saving the profile.';
    return;
  }

  try {
    const profile = await community.saveProfile({ email, displayName });
    syncCommunity();
    renderPlayerCard();
    elements.communityOutput.textContent = isCloudCommunityActive()
      ? `Cloud profile saved for ${profile.displayName}.`
      : `Signed in locally as ${profile.displayName}.`;
  } catch (error) {
    elements.communityOutput.textContent = `Could not save profile: ${getErrorMessage(error)}`;
  }
}

async function saveIntroProfileFromFields({ requireProfile = false } = {}) {
  const displayName = elements.introName?.value?.trim() || '';
  const email = elements.introEmail?.value?.trim() || '';

  if (communityState.profile) return true;

  if (!displayName || !email) {
    if (!requireProfile) return true;
    const missingField = !displayName ? elements.introName : elements.introEmail;
    missingField?.focus({ preventScroll: true });
    if (elements.introHelp) elements.introHelp.textContent = 'Name and email unlock Dev Studio.';
    return false;
  }

  elements.profileName.value = displayName;
  elements.profileEmail.value = email;

  try {
    await community.saveProfile({ email, displayName });
    syncCommunity();
    renderPlayerCard();
    showToast(`Welcome, ${displayName}`, { kind: 'success' });
    return true;
  } catch (error) {
    elements.communityOutput.textContent = `Could not save intro profile: ${getErrorMessage(error)}`;
    if (elements.introHelp) elements.introHelp.textContent = 'Account save failed. Try again.';
    return false;
  }
}

async function saveCurrentCreation({ publish = false } = {}) {
  if (publish && requiresCloudSignInForSharedAction()) {
    showSignInRequired('publish');
    return null;
  }

  if (!communityState.profile) {
    elements.communityOutput.textContent = isCloudCommunityActive()
      ? 'Cloud profile is still syncing. Try again in a moment.'
      : 'Create a local account before saving this board.';
    return null;
  }

  if (publish && !hasPublishMetadata()) {
    elements.communityOutput.textContent = 'Add a title, description, and at least one tag before publishing.';
    elements.devOutput.textContent = 'Publish needs a title, description, and tags.';
    showToast('Add publish details first', { kind: 'warning' });
    return null;
  }

  const coordinates = getLiveCoordinates();
  const editingInDev = state.devProjectActive && state.activeDesignSession?.kind === 'editing';
  const activeCreationId = editingInDev ? state.activeDesignSession?.creationId : null;
  const title = editingInDev
    ? elements.devDesignTitle.value
    : elements.creationTitle.value;
  const description = editingInDev
    ? elements.devDesignDescription.value
    : elements.creationDescription.value;
  const tags = editingInDev ? elements.devDesignTags.value : elements.creationTags.value;
  const input = {
    title: title || getSuggestedCreationTitle(),
    description,
    tags,
    attribution: editingInDev ? elements.devDesignAttribution.value : '',
    tutorialReference: editingInDev ? elements.devDesignTutorial.value : '',
    rle: encodeRle(coordinates),
    width: state.board.width,
    height: state.board.height,
    generation: state.board.generation,
    population: coordinates.length,
    thumbnail: captureBoardThumbnail(),
    settings: getCurrentDesignSettings(),
  };
  let creation;
  setSaveStatus('saving');
  try {
    if (activeCreationId) {
      creation = await community.updateCreationMetadata(activeCreationId, input);
      if (state.designDirty) creation = await community.saveVersion(activeCreationId, input);
      if (publish) creation = await community.publishCreation(activeCreationId);
    } else {
      creation = await community.createCreation(input, { publish });
    }
  } catch (error) {
    setSaveStatus(navigator.onLine === false ? 'offline' : 'failed');
    elements.communityOutput.textContent = error.name === 'QuotaExceededError'
      ? 'Could not save: browser storage is full. Remove some builds and try again.'
      : `Could not save: ${getErrorMessage(error)}`;
    return null;
  }

  if (!creation) {
    setSaveStatus('failed');
    return null;
  }

  if (editingInDev) {
    state.activeDesignSession.creationId = creation.id;
    state.activeDesignSession.title = creation.title;
  }
  setDesignMetadataFields(creation);
  syncCommunity();
  markDesignDirty(false);
  clearLocalRecovery();
  triggerHaptic('save');
  showToast(publish ? 'Published to Community' : 'Draft saved', { kind: 'success' });
  elements.communityOutput.textContent = publish
    ? `Published ${creation.title}. It now appears in Trending.`
    : `Saved ${creation.title} as version ${creation.currentVersion?.versionNumber || 1}.`;
  elements.devOutput.textContent = publish
    ? `Published ${creation.title} to Community.`
    : `Saved version ${creation.currentVersion?.versionNumber || 1} of ${creation.title}.`;

  return creation;
}

function hasPublishMetadata() {
  const editingInDev = state.devProjectActive && state.activeDesignSession?.kind === 'editing';
  return Boolean(
    (editingInDev ? elements.devDesignTitle.value : elements.creationTitle.value).trim()
      && (editingInDev ? elements.devDesignDescription.value : elements.creationDescription.value).trim()
      && (editingInDev ? elements.devDesignTags.value : elements.creationTags.value).trim(),
  );
}

async function publishActiveCreation() {
  await saveCurrentCreation({ publish: true });
}

async function unpublishActiveCreation() {
  const creationId = state.activeDesignSession?.creationId;
  if (!creationId) return;
  setSaveStatus('saving');
  try {
    const creation = await community.unpublishCreation(creationId);
    if (!creation) return;
    syncCommunity();
    setSaveStatus('saved');
    elements.devOutput.textContent = `${creation.title} is now private.`;
    showToast('Design unpublished', { kind: 'success' });
  } catch (error) {
    setSaveStatus('failed');
    elements.devOutput.textContent = `Could not unpublish: ${getErrorMessage(error)}`;
  }
}

async function archiveActiveCreation() {
  const creationId = state.activeDesignSession?.creationId;
  if (!creationId || !window.confirm('Archive this design? It will become private and leave the active project list.')) return;
  try {
    const creation = await community.archiveCreation(creationId);
    if (!creation) return;
    state.devProjectActive = false;
    state.activeDesignSession = null;
    clearLocalRecovery();
    syncCommunity();
    setMode('dev');
    showToast('Design archived', { kind: 'success' });
  } catch (error) {
    setSaveStatus('failed');
    elements.devOutput.textContent = `Could not archive: ${getErrorMessage(error)}`;
  }
}

async function deleteActiveCreation() {
  const creationId = state.activeDesignSession?.creationId;
  if (!creationId || !window.confirm('Permanently delete this design and every version? This cannot be undone.')) return;
  try {
    const deleted = await community.deleteCreation(creationId);
    if (!deleted) return;
    state.devProjectActive = false;
    state.activeDesignSession = null;
    clearLocalRecovery();
    syncCommunity();
    setMode('dev');
    showToast('Design deleted', { kind: 'success' });
  } catch (error) {
    setSaveStatus('failed');
    elements.devOutput.textContent = `Could not delete: ${getErrorMessage(error)}`;
  }
}

async function restoreActiveVersion(versionId) {
  const creationId = state.activeDesignSession?.creationId;
  if (!creationId) return;
  setSaveStatus('saving');
  try {
    const creation = await community.restoreVersion(creationId, versionId);
    if (!creation) return;
    loadCreationOntoBoard(creation, { center: true });
    syncCommunity();
    setSaveStatus('saved');
    elements.devOutput.textContent = `Restored version as new version ${creation.currentVersion.versionNumber}.`;
    showToast('Version restored', { kind: 'success' });
  } catch (error) {
    setSaveStatus('failed');
    elements.devOutput.textContent = `Could not restore version: ${getErrorMessage(error)}`;
  }
}

async function copySharePayload() {
  const active = getActiveCreation() || await saveCurrentCreation();

  if (!active) return;

  const link = encodeShareLink(active, { origin: window.location.origin + window.location.pathname });

  try {
    await navigator.clipboard.writeText(link);
    elements.communityOutput.textContent = `Copied a share link for ${active.title}.`;
    triggerHaptic('copy');
    showToast('Share link copied', { kind: 'success' });
  } catch {
    elements.rleField.value = link;
    elements.communityOutput.textContent = 'Clipboard was unavailable, so the share link was placed in the RLE box.';
    showToast('Share link moved to RLE box', { kind: 'warning' });
  }
}

function importSharedBuildFromHash() {
  const shared = decodeShareLink(window.location.hash);
  if (!shared) return;

  try {
    const pattern = parseRle(shared.rle);
    state.board = clearBoard(state.board);
    state.board = placePattern(state.board, pattern.coordinates, 0, 0);
    resetCellEffects();
    markLivingCells(230, 1);
    updateStats();
    elements.creationTitle.value = shared.title || '';
    elements.creationDescription.value = shared.description || '';
    elements.creationTags.value = (shared.tags || []).join(', ');
    setMode('community');
    elements.communityOutput.textContent = shared.ownerName
      ? `Loaded a shared build from ${shared.ownerName}. Save it to add it to your library.`
      : 'Loaded a shared build. Save it to add it to your library.';
  } catch {
    elements.communityOutput.textContent = 'That share link could not be opened. Its build payload needs repair.';
  }
}

function loadCommunityCreation(creationId) {
  const creation = community.findCreation(creationId);

  if (!creation) return;

  try {
    loadCreationOntoBoard(creation, { center: true });
    community.setActiveCreation(creation.id);
    syncCommunity();
    elements.communityOutput.textContent = `Opened ${creation.title} on the board.`;
    elements.devOutput.textContent = `Opened ${creation.title}. ${getDesignSettingSummary(getCurrentDesignSettings())}.`;
    showToast(`Opened ${creation.title}`, { kind: 'success' });
  } catch {
    elements.communityOutput.textContent = `Could not open ${creation.title}. Its RLE payload needs repair.`;
  }
}

function loadCreationOntoBoard(creation, { center = true } = {}) {
  const version = creation.currentVersion || {};
  const settings = version.settings
    ? createDesignSettings(version.settings)
    : createDesignSettings({
      gridPreset: 'custom',
      width: version.width || state.board.width,
      height: version.height || state.board.height,
    });
  const pattern = parseRle(version.rle);
  const nextBoard = createBoard(version.width || settings.width, version.height || settings.height);

  state.designSettings = settings;
  state.board = placePattern(nextBoard, pattern.coordinates, 0, 0);
  state.board.generation = Number(version.generation || 0);
  resetBoardStorage();
  markLivingCells(230, 1);
  if (center) centerWorld();
  setSpeed(settings.speed);
  setZoom(settings.zoom);
  syncDesignControls();
  markDesignDirty(false);
  updateStats();
}

async function starCommunityCreation(creationId) {
  if (requiresCloudSignInForSharedAction()) {
    showSignInRequired('star');
    return;
  }

  if (!communityState.profile) {
    elements.communityOutput.textContent = 'Create an account before starring builds.';
    return;
  }

  let nextCreation;
  try {
    nextCreation = await community.toggleStar(creationId, communityState.profile.id);
    if (!nextCreation) return;
  } catch (error) {
    elements.communityOutput.textContent = `Could not update star: ${getErrorMessage(error)}`;
    return;
  }

  syncCommunity();
  elements.communityOutput.textContent = nextCreation.starredBy.includes(communityState.profile.id)
    ? `Starred ${nextCreation.title}.`
    : `Removed star from ${nextCreation.title}.`;
}

async function cloneCommunityCreation(creationId) {
  if (requiresCloudSignInForSharedAction()) {
    showSignInRequired('clone');
    return;
  }

  if (!communityState.profile) {
    elements.communityOutput.textContent = 'Create an account before cloning builds.';
    return;
  }

  let remix;
  try {
    remix = await community.cloneCreation(creationId, communityState.profile);
    if (!remix) return;
  } catch (error) {
    elements.communityOutput.textContent = `Could not clone build: ${getErrorMessage(error)}`;
    return;
  }

  const source = community.findCreation(remix.remixedFromId);
  syncCommunity();
  elements.communityOutput.textContent = `Cloned ${source?.title ?? 'build'}. The remix is private until you publish it.`;
}

async function renderCommunity() {
  renderCommunityAuth();
  renderPlayerCard();
  syncCommunityFilterUi();

  if (communityState.profile) {
    elements.profileName.value = communityState.profile.displayName;
    elements.profileEmail.value = communityState.profile.email;
    elements.saveProfile.textContent = isCloudCommunityActive() ? 'Update Profile' : 'Update Account';
  } else {
    elements.saveProfile.textContent = isCloudCommunityActive() ? 'Create Profile' : 'Create Account';
  }

  elements.communityCount.textContent = `${communityState.creations.length} builds`;
  renderDevStudio();

  const ownCreations = communityState.profile
    ? communityState.creations.filter((creation) => creation.ownerId === communityState.profile.id)
    : communityState.creations;
  const trending = await community.listTrendingCreations();
  const famous = getFamousCommunityDesigns();
  const newest = [...ownCreations].sort((left, right) => String(right.updatedAt).localeCompare(String(left.updatedAt)));
  const remixes = communityState.creations.filter((creation) => creation.remixedFromId);

  renderCommunityList(elements.communityFamousList, famous, 'Famous designs will appear here.', { source: 'famous' });
  renderCommunityList(elements.trendingList, trending, 'Publish a build to start the trending list.', { source: 'trending' });
  renderCommunityList(elements.communityList, newest, 'No saved builds yet.', { source: 'new' });
  renderCommunityList(elements.communityRemixList, remixes, 'Copy or remix a design to start a lineage.', { source: 'remixes' });

  if (!state.selectedCommunityId || !findCommunityDesign(state.selectedCommunityId)) {
    state.selectedCommunityId = famous[0]?.id || trending[0]?.id || newest[0]?.id || null;
  }
  renderCommunityDetail(findCommunityDesign(state.selectedCommunityId));
}

function setCommunityFilter(value) {
  state.communityFilter = value || 'all';
  if (elements.communityFilter) elements.communityFilter.value = state.communityFilter;
  syncCommunityFilterUi();
  renderCommunity();
}

function syncCommunityFilterUi() {
  if (!elements.communityFilterLabel || !elements.communityFilterOptions.length) return;

  const selected = [...elements.communityFilterOptions]
    .find((option) => option.dataset.communityFilterValue === state.communityFilter)
    || elements.communityFilterOptions[0];

  elements.communityFilterLabel.textContent = selected.textContent;
  for (const option of elements.communityFilterOptions) {
    option.setAttribute('aria-selected', String(option === selected));
    option.classList.toggle('active', option === selected);
  }
}

function renderPlayerCard() {
  if (!elements.playerName || !elements.playerMeta) return;

  if (communityState.profile) {
    elements.playerName.textContent = communityState.profile.displayName || 'Local Builder';
    elements.playerMeta.textContent = communityState.profile.email || communityState.profile.username || 'Local profile active';
    return;
  }

  elements.playerName.textContent = 'Guest Builder';
  elements.playerMeta.textContent = 'Play around or create a profile';
}

function renderDevStudio() {
  if (!elements.devPanel) return;

  const profile = communityState.profile;
  const creations = profile
    ? communityState.creations.filter((creation) => creation.ownerId === profile.id && !creation.archivedAt)
    : communityState.creations.filter((creation) => !creation.archivedAt);
  const published = creations.filter((creation) => creation.visibility === 'public');
  const drafts = creations.filter((creation) => creation.visibility !== 'public');
  const starredCount = communityState.creations.filter((creation) => creation.starredBy?.includes(profile?.id)).length;

  if (elements.devProfileName) elements.devProfileName.textContent = profile?.displayName || 'Local Builder';
  if (elements.devProfileMeta) {
    elements.devProfileMeta.textContent = profile
      ? `${profile.email || profile.username} · ${creations.length} saved designs`
      : 'Create a profile to track designs.';
  }
  if (elements.devDesignCount) elements.devDesignCount.textContent = creations.length;
  if (elements.devDraftCount) elements.devDraftCount.textContent = drafts.length;
  if (elements.devPublishedCount) elements.devPublishedCount.textContent = published.length;
  if (elements.devStarredCount) elements.devStarredCount.textContent = starredCount;
  if (elements.devDesignTitle && document.activeElement !== elements.devDesignTitle) {
    elements.devDesignTitle.value = state.activeDesignSession?.title || elements.creationTitle?.value || 'Untitled design';
  }
  const activeCreation = state.activeDesignSession?.creationId
    ? community.findCreation(state.activeDesignSession.creationId)
    : null;
  if (activeCreation) setDesignMetadataFields(activeCreation);
  if (elements.devSessionState) {
    elements.devSessionState.textContent = activeCreation
      ? `Version ${activeCreation.currentVersion?.versionNumber || 1}`
      : state.activeDesignSession?.sourceTitle ? 'Clone' : 'New';
  }
  if (elements.saveDesign) elements.saveDesign.textContent = activeCreation ? 'Save Version' : 'Save Draft';
  if (elements.unpublishDesign) elements.unpublishDesign.disabled = activeCreation?.visibility !== 'public';
  if (elements.archiveDesign) elements.archiveDesign.disabled = !activeCreation;
  if (elements.deleteDesign) elements.deleteDesign.disabled = !activeCreation;
  renderVersionHistory(activeCreation);
  renderProjectList(creations);
  renderTutorials();
  syncDesignControls();
}

function renderVersionHistory(creation) {
  if (!elements.devVersionList || !elements.devVersionCount) return;
  const versions = [...(creation?.versions || (creation?.currentVersion ? [creation.currentVersion] : []))]
    .sort((left, right) => Number(right.versionNumber || 0) - Number(left.versionNumber || 0));
  elements.devVersionCount.textContent = String(versions.length);
  elements.devVersionList.innerHTML = '';

  if (versions.length === 0) {
    elements.devVersionList.innerHTML = '<p class="community-empty">Save the draft to create version 1.</p>';
    return;
  }

  for (const version of versions) {
    const row = document.createElement('div');
    const current = version.id === creation.currentVersion?.id;
    row.className = `version-row${current ? ' current' : ''}`;
    row.innerHTML = `
      <span><strong>Version ${version.versionNumber || 1}</strong><small>${current ? 'Current' : `${version.population || 0} cells`}</small></span>
      <button type="button" data-restore-version-id="${escapeHtml(version.id)}" ${current ? 'disabled' : ''}>Restore</button>
    `;
    elements.devVersionList.append(row);
  }
}

function renderProjectList(creations) {
  if (!elements.devProjectList) return;
  elements.devProjectList.innerHTML = '';

  if (creations.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'community-empty';
    empty.textContent = 'Saved drafts and published designs open here.';
    elements.devProjectList.append(empty);
    return;
  }

  for (const creation of creations) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'project-card';
    button.dataset.devProjectId = creation.id;
    button.innerHTML = `
      <strong>${escapeHtml(creation.title)}</strong>
      <span>${escapeHtml(getDesignSettingSummary(creation.currentVersion?.settings || {
        width: creation.currentVersion?.width,
        height: creation.currentVersion?.height,
      }))}</span>
      <small>${creation.visibility === 'public' ? 'Published' : 'Draft'} · ${creation.starCount || 0} stars</small>
    `;
    elements.devProjectList.append(button);
  }
}

function renderTutorials() {
  if (!elements.tutorialGroups || !elements.tutorialList) return;
  elements.tutorialGroups.innerHTML = '';
  elements.tutorialList.innerHTML = '';
  if (elements.tutorialCount) elements.tutorialCount.textContent = tutorialCatalog.length;

  for (const group of tutorialGroups) {
    const button = document.createElement('button');
    const active = group.id === state.activeTutorialGroup;
    button.type = 'button';
    button.className = 'pattern-tab';
    button.dataset.tutorialGroup = group.id;
    button.classList.toggle('active', active);
    button.innerHTML = `<span>${group.title}</span><small>${getTutorialsByGroup(group.id).length}</small>`;
    elements.tutorialGroups.append(button);
  }

  for (const tutorial of getTutorialsByGroup(state.activeTutorialGroup)) {
    const card = document.createElement('article');
    card.className = 'tutorial-card';
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(tutorial.title)}</strong>
        <a href="${tutorial.sourceUrl}" target="_blank" rel="noreferrer">Source</a>
      </div>
      <p>${escapeHtml(tutorial.goal)}</p>
      <small>${escapeHtml(tutorial.modifyPrompt)}</small>
      <button type="button" data-tutorial-title="${escapeHtml(tutorial.title)}" ${tutorial.patternId ? `data-tutorial-pattern="${tutorial.patternId}"` : ''}>
        ${tutorial.patternId ? 'Load Pattern' : 'Use Reference'}
      </button>
    `;
    elements.tutorialList.append(card);
  }
}

function renderCommunityList(container, creations, emptyText, { source }) {
  if (!container) return;

  container.innerHTML = '';
  const visible = getFilteredCommunityItems(creations, source);
  const actionCopy = getCommunityActionCopy();

  if (visible.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'community-empty';
    empty.textContent = emptyText;
    container.append(empty);
    return;
  }

  for (const creation of visible) {
    const card = document.createElement('article');
    card.className = 'community-card';
    card.classList.toggle('active', state.selectedCommunityId === creation.id);
    card.dataset.communityAction = 'detail';
    card.dataset.creationId = creation.id;
    card.tabIndex = 0;
    card.setAttribute('role', 'button');
    card.setAttribute('aria-label', `Preview ${creation.title}`);
    const starred = communityState.profile && creation.starredBy?.includes(communityState.profile.id);
    card.innerHTML = `
      <button class="community-preview" type="button" data-community-action="detail" data-creation-id="${creation.id}" aria-label="View ${escapeHtml(creation.title)}">
        ${getCommunityPreviewHtml(creation)}
      </button>
      <div>
        <strong>${escapeHtml(creation.title)}</strong>
        <span>${creation.visibility === 'public' ? 'Published' : 'Draft'} by ${escapeHtml(creation.ownerName)}</span>
      </div>
      <p>${escapeHtml(creation.description || 'No description yet.')}</p>
      <div class="community-tags">${creation.tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
      <div class="community-stats">
        <span>${creation.starCount || 0} stars</span>
        <span>${creation.commentCount || getCommunityComments(creation).length} comments</span>
        <span>${creation.cloneCount || 0} remixes</span>
        <span>${creation.currentVersion?.population || 0} cells</span>
      </div>
      <div class="community-actions">
        <button type="button" data-community-action="play-copy" data-creation-id="${creation.id}">${actionCopy.play}</button>
        <button type="button" data-community-action="edit-copy" data-creation-id="${creation.id}">${actionCopy.edit}</button>
        <button type="button" data-community-action="star" data-creation-id="${creation.id}">${starred ? 'Unstar' : actionCopy.star}</button>
        <button type="button" data-community-action="copy" data-creation-id="${creation.id}">${actionCopy.share}</button>
      </div>
    `;
    container.append(card);
  }
}

function getCommunityPreviewHtml(creation) {
  try {
    const pattern = parseRle(creation.currentVersion?.rle || '');
    const bounds = getPatternBounds(pattern.coordinates);
    const columns = Math.min(18, Math.max(6, bounds.width));
    const rows = Math.min(12, Math.max(5, bounds.height));
    const cells = new Set();

    for (const [x, y] of pattern.coordinates) {
      const scaledX = bounds.width <= 1 ? 0 : Math.round((x - bounds.minX) / (bounds.width - 1) * (columns - 1));
      const scaledY = bounds.height <= 1 ? 0 : Math.round((y - bounds.minY) / (bounds.height - 1) * (rows - 1));
      cells.add(`${scaledX},${scaledY}`);
    }

    return `
      <span class="preview-grid" style="--preview-cols:${columns};--preview-rows:${rows}">
        ${[...cells].map((cell) => {
    const [x, y] = cell.split(',').map(Number);
    return `<span style="grid-column:${x + 1};grid-row:${y + 1}"></span>`;
  }).join('')}
      </span>
    `;
  } catch {
    return '<span class="preview-grid preview-grid-empty"></span>';
  }
}

function getFilteredCommunityItems(creations, source) {
  const filter = state.communityFilter;
  if (filter !== 'all' && filter !== source) return [];

  const query = state.communitySearch.trim().toLowerCase();
  if (!query) return creations;

  return creations.filter((creation) => [
    creation.title,
    creation.ownerName,
    creation.description,
    ...(creation.tags || []),
  ].some((value) => String(value || '').toLowerCase().includes(query)));
}

function getFamousCommunityDesigns() {
  const famous = [
    {
      id: 'glider',
      title: 'Glider',
      description: 'The smallest spaceship and the hello-world of Life motion.',
      tags: ['spaceship', 'starter', 'famous'],
      stars: 128,
      clones: 38,
    },
    {
      id: 'gosper-gun',
      title: 'Gosper glider gun',
      description: 'The first known gun: a repeating source that emits gliders.',
      tags: ['gun', 'glider', 'classic'],
      stars: 342,
      clones: 91,
    },
    {
      id: 'pulsar',
      title: 'Pulsar',
      description: 'A symmetric period-3 oscillator with a readable rhythm.',
      tags: ['oscillator', 'period-3', 'starter'],
      stars: 210,
      clones: 44,
    },
    {
      id: 'r-pentomino',
      title: 'R-pentomino',
      description: 'A tiny methuselah that stays chaotic for a surprisingly long time.',
      tags: ['methuselah', 'chaos', 'famous'],
      stars: 186,
      clones: 27,
    },
    {
      id: 'acorn',
      title: 'Acorn',
      description: 'Seven cells that create a long-lived, expansive sequence.',
      tags: ['methuselah', 'growth', 'classic'],
      stars: 174,
      clones: 31,
    },
    {
      id: 'diehard',
      title: 'Diehard',
      description: 'A finite pattern famous for living a long time before disappearing.',
      tags: ['methuselah', 'extinction', 'classic'],
      stars: 149,
      clones: 23,
    },
  ];

  return famous.map((entry) => {
    const preset = findPreset(entry.id);
    const bounds = getPatternBounds(preset.coordinates);

    return {
      id: `famous-${entry.id}`,
      title: entry.title,
      slug: `famous-${entry.id}`,
      description: entry.description,
      visibility: 'public',
      ownerId: 'lifewiki',
      ownerName: 'LifeWiki',
      thumbnail: '',
      tags: entry.tags,
      starCount: entry.stars,
      cloneCount: entry.clones,
      viewCount: entry.stars * 10,
      commentCount: getCommunityComments({ id: `famous-${entry.id}` }).length,
      comments: [],
      starredBy: [],
      remixedFromId: null,
      rootCreationId: `famous-${entry.id}`,
      currentVersion: {
        id: `famous-version-${entry.id}`,
        rle: encodeRle(preset.coordinates),
        width: Math.max(80, bounds.width + 24),
        height: Math.max(60, bounds.height + 24),
        generation: 0,
        population: preset.coordinates.length,
        rule: 'B3/S23',
        settings: serializeDesignSettings(createDesignSettings({
          gridPreset: 'custom',
          width: Math.max(80, bounds.width + 24),
          height: Math.max(60, bounds.height + 24),
          renderStyle: entry.id === 'pulsar' ? 'rounded' : 'glow',
        })),
        createdAt: '2026-06-30T00:00:00.000Z',
      },
      createdAt: '2026-06-30T00:00:00.000Z',
      updatedAt: '2026-06-30T00:00:00.000Z',
      publishedAt: '2026-06-30T00:00:00.000Z',
    };
  });
}

function findCommunityDesign(creationId) {
  if (!creationId) return null;
  return community.findCreation(creationId)
    || getFamousCommunityDesigns().find((creation) => creation.id === creationId)
    || null;
}

function getCommunityComments(creation) {
  return state.communityComments[creation.id] || creation.comments || [];
}

function renderCommunityDetail(creation) {
  if (!elements.communityDetail) return;

  if (!creation) {
    elements.communityDetail.innerHTML = '<p class="community-empty">Select a design to inspect, copy, comment, or remix.</p>';
    return;
  }

  const comments = getCommunityComments(creation);
  const actionCopy = getCommunityActionCopy();
  const lineage = creation.remixedFromId
    ? `Based on ${creation.remixedFromId}`
    : 'Original or historical design';

  elements.communityDetail.innerHTML = `
    <div class="detail-preview" aria-hidden="true">${getCommunityPreviewHtml(creation)}</div>
    <div class="section-heading">
      <h2>${escapeHtml(creation.title)}</h2>
      <span>${creation.starCount || 0} stars</span>
    </div>
    <p>${escapeHtml(creation.description || 'No description yet.')}</p>
    <div class="community-tags">${(creation.tags || []).map((tag) => `<span>${escapeHtml(tag)}</span>`).join('')}</div>
    <dl class="detail-stats">
      <div><dt>Author</dt><dd>${escapeHtml(creation.ownerName)}</dd></div>
      <div><dt>Grid</dt><dd>${creation.currentVersion?.width || 0} x ${creation.currentVersion?.height || 0}</dd></div>
      <div><dt>Cells</dt><dd>${creation.currentVersion?.population || 0}</dd></div>
      <div><dt>Lineage</dt><dd>${escapeHtml(lineage)}</dd></div>
    </dl>
    <div class="community-actions detail-actions">
      <button type="button" data-community-action="play-copy" data-creation-id="${creation.id}">${actionCopy.play}</button>
      <button type="button" data-community-action="edit-copy" data-creation-id="${creation.id}">${actionCopy.edit}</button>
      <button type="button" data-community-action="copy" data-creation-id="${creation.id}">${actionCopy.share}</button>
      <button type="button" data-community-action="remix" data-creation-id="${creation.id}">Remix</button>
    </div>
    <div class="comments-list">
      <h3>Comments ${comments.length}</h3>
      ${comments.length === 0
    ? '<p class="community-empty">No comments yet.</p>'
    : comments.map((comment) => `
          <article class="comment">
            <strong>${escapeHtml(comment.authorName)}</strong>
            <p>${escapeHtml(comment.body)}</p>
          </article>
        `).join('')}
    </div>
  `;
}

async function handleCommunityAction(event) {
  const button = event.target.closest('[data-community-action]');
  if (!button) return;

  const { communityAction, creationId } = button.dataset;

  if (communityAction === 'detail') {
    state.selectedCommunityId = creationId;
    renderCommunityDetail(findCommunityDesign(creationId));
    syncCommunitySelection();
    return;
  }

  if (communityAction === 'play-copy') {
    playCommunityDesign(creationId);
    return;
  }

  if (communityAction === 'edit-copy') {
    await editCommunityClone(creationId);
    return;
  }

  if (communityAction === 'star') {
    if (creationId.startsWith('famous-')) {
      showToast('Starred historical design', { kind: 'success' });
      elements.communityOutput.textContent = 'Historical design starred locally for this session.';
      return;
    }
    await starCommunityCreation(creationId);
    state.selectedCommunityId = creationId;
    renderCommunityDetail(findCommunityDesign(creationId));
    return;
  }

  if (communityAction === 'copy') {
    await copyCommunityDesign(creationId);
    return;
  }

  if (communityAction === 'remix') {
    await remixCommunityDesign(creationId);
  }
}

function syncCommunitySelection() {
  for (const card of document.querySelectorAll('.community-card[data-creation-id]')) {
    card.classList.toggle('active', card.dataset.creationId === state.selectedCommunityId);
  }
}

function playCommunityDesign(creationId) {
  const source = findCommunityDesign(creationId);
  if (!source) return;

  try {
    loadCreationOntoBoard(source, { center: true });
    state.selectedCommunityId = creationId;
    state.devProjectActive = false;
    state.activeDesignSession = {
      kind: 'playing',
      sourceTitle: source.title,
      sourceOwnerName: source.ownerName,
      title: source.title,
    };
    state.playing = true;
    updatePlayButton();
    setMode('playground');
    elements.communityOutput.textContent = `Playing ${source.ownerName}'s design: ${source.title}.`;
    elements.activeNote.textContent = getActiveDesignStatusText();
    showToast(`Playing ${source.title}`, { kind: 'success' });
  } catch (error) {
    elements.communityOutput.textContent = `Could not play design: ${getErrorMessage(error)}`;
  }
}

async function editCommunityClone(creationId) {
  const source = findCommunityDesign(creationId);
  if (!source) return;

  if (!communityState.profile) {
    elements.communityOutput.textContent = 'Create a profile before editing a clone into your portfolio.';
    showToast('Create a profile first', { kind: 'warning' });
    setMode('dev');
    return;
  }

  try {
    const copy = await createEditableCommunityCopy(source, creationId);
    loadCreationOntoBoard(copy, { center: true });
    state.selectedCommunityId = creationId;
    startDevProject('design', {
      title: copy.title,
      creationId: community.findCreation(copy.id) ? copy.id : null,
      source,
      boardLoaded: true,
      openTools: true,
    });
    setDesignMetadataFields(copy);
    elements.communityOutput.textContent = communityState.profile
      ? `Created ${copy.title} in your portfolio.`
      : `Opened a guest copy of ${source.title}. Create a profile to save it.`;
    elements.devOutput.textContent = `Editing ${copy.title}. ${getDesignSettingSummary(getCurrentDesignSettings())}.`;
    showToast('Edit clone ready', { kind: 'success' });
  } catch (error) {
    elements.communityOutput.textContent = `Could not open a copy: ${getErrorMessage(error)}`;
  }
}

async function createEditableCommunityCopy(source, sourceId) {
  if (!communityState.profile) {
    return createGuestCommunityCopy(source);
  }

  if (!sourceId.startsWith('famous-') && community.findCreation(sourceId)) {
    const remix = await community.cloneCreation(sourceId, communityState.profile);
    syncCommunity();
    return remix;
  }

  const copy = await community.saveCreation(toCommunityCopyInput(source));
  syncCommunity();
  return copy;
}

function createGuestCommunityCopy(source) {
  return {
    ...source,
    id: `guest-copy-${source.id}`,
    title: `${source.title} Copy`,
    slug: `guest-copy-${source.slug || source.id}`,
    visibility: 'private',
    ownerId: 'profile-local',
    ownerName: 'Guest Builder',
    starCount: 0,
    cloneCount: 0,
    starredBy: [],
    remixedFromId: source.id,
    rootCreationId: source.rootCreationId || source.id,
    currentVersion: {
      ...source.currentVersion,
      id: `guest-version-${source.currentVersion?.id || source.id}`,
    },
  };
}

function toCommunityCopyInput(source) {
  const title = createRemixTitle({ sourceTitle: source.title, profile: communityState.profile });

  return {
    title,
    description: source.description,
    tags: source.tags,
    rle: source.currentVersion?.rle,
    width: source.currentVersion?.width,
    height: source.currentVersion?.height,
    generation: source.currentVersion?.generation,
    population: source.currentVersion?.population,
    thumbnail: source.thumbnail,
    settings: source.currentVersion?.settings,
  };
}

async function copyCommunityDesign(creationId) {
  const creation = findCommunityDesign(creationId);
  if (!creation) return;

  const link = encodeShareLink(creation, { origin: window.location.origin + window.location.pathname });
  try {
    await navigator.clipboard.writeText(link);
    triggerHaptic('copy');
    showToast('Design copied', { kind: 'success' });
    elements.communityOutput.textContent = `Copied ${creation.title}.`;
  } catch {
    elements.rleField.value = link;
    showToast('Copied into RLE box', { kind: 'warning' });
    elements.communityOutput.textContent = 'Clipboard was unavailable, so the design link is in the RLE box.';
  }
}

async function remixCommunityDesign(creationId) {
  const creation = findCommunityDesign(creationId);
  if (!creation) return;

  if (!communityState.profile) {
    elements.communityOutput.textContent = 'Create a profile before remixing designs.';
    showToast('Create a profile first', { kind: 'warning' });
    return;
  }

  if (creationId.startsWith('famous-')) {
    try {
      const remix = await community.saveCreation({
        title: createRemixTitle({ sourceTitle: creation.title, profile: communityState.profile }),
        description: creation.description,
        tags: creation.tags,
        rle: creation.currentVersion.rle,
        width: creation.currentVersion.width,
        height: creation.currentVersion.height,
        generation: creation.currentVersion.generation,
        population: creation.currentVersion.population,
        thumbnail: creation.thumbnail,
        settings: creation.currentVersion.settings,
      });
      syncCommunity();
      loadCreationOntoBoard(remix, { center: true });
      setMode('dev');
      elements.communityOutput.textContent = `Created a private remix of ${creation.title}.`;
      showToast('Remix draft created', { kind: 'success' });
    } catch (error) {
      elements.communityOutput.textContent = `Could not remix design: ${getErrorMessage(error)}`;
    }
    return;
  }

  await cloneCommunityCreation(creationId);
  const remix = community.findCreation(community.getState().activeCreationId);
  if (remix) {
    loadCreationOntoBoard(remix, { center: true });
    setMode('dev');
    showToast('Remix draft created', { kind: 'success' });
  }
}

function postCommunityComment() {
  const creation = findCommunityDesign(state.selectedCommunityId);
  if (!creation) {
    showToast('Select a design first', { kind: 'warning' });
    return;
  }

  const body = elements.commentBody.value;
  const commented = addCreationComment({
    ...creation,
    comments: getCommunityComments(creation),
  }, {
    profileId: communityState.profile?.id || 'profile-local',
    authorName: communityState.profile?.displayName || 'Local Builder',
    body,
  });

  state.communityComments[creation.id] = commented.comments;
  elements.commentBody.value = '';
  renderCommunityDetail({
    ...creation,
    comments: commented.comments,
    commentCount: commented.commentCount,
  });
  showToast('Comment added', { kind: 'success' });
}

function getActiveCreation() {
  return community.findCreation(communityState.activeCreationId);
}

function syncCommunity() {
  communityState = community.getState();
  renderCommunity();
}

function getSuggestedCreationTitle() {
  return `Life build ${communityState.creations.length + 1}`;
}

function captureBoardThumbnail() {
  try {
    return canvas.toDataURL('image/png');
  } catch {
    return '';
  }
}

function escapeHtml(value) {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderPresets() {
  elements.presetCount.textContent = `${presets.length}`;
  elements.patternTabs.innerHTML = '';
  elements.presets.innerHTML = '';

  const activeGroup = getPresetGroup(presetGroups, state.activePresetGroup) ?? presetGroups[0];
  state.activePresetGroup = activeGroup.id;

  for (const group of presetGroups) {
    const tab = document.createElement('button');
    const active = group.id === activeGroup.id;
    tab.type = 'button';
    tab.className = 'pattern-tab';
    tab.dataset.patternTab = group.id;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-selected', String(active));
    tab.classList.toggle('active', active);
    tab.innerHTML = `
      <span>${group.title}</span>
      <small>${group.ids.length}</small>
    `;
    tab.addEventListener('click', () => {
      state.activePresetGroup = group.id;
      renderPresets();
      updatePresetSelection();
    });
    elements.patternTabs.append(tab);
  }

  const groupElement = document.createElement('section');
  groupElement.className = 'preset-group';
  groupElement.setAttribute('role', 'tabpanel');
  groupElement.innerHTML = `
    <div class="preset-group-heading">
      <strong>${activeGroup.title}</strong>
      <span>${activeGroup.note}</span>
    </div>
  `;

  for (const id of activeGroup.ids) {
    const preset = presets.find((candidate) => candidate.id === id);
    if (!preset) continue;

    const button = document.createElement('button');
    button.className = 'preset';
    button.type = 'button';
    button.dataset.presetId = preset.id;
    button.innerHTML = `
      <span class="preset-topline">
        <span class="preset-name">${preset.name}</span>
        <span class="preset-meta">${getPresetStampSummary(preset)}</span>
      </span>
      <span class="preset-note">${preset.note}</span>
    `;
    button.draggable = true;
    button.addEventListener('click', () => selectPreset(preset));
    button.addEventListener('dragstart', (event) => {
      selectPreset(preset);
      event.dataTransfer.effectAllowed = 'copy';
      event.dataTransfer.setData('text/life-preset-id', preset.id);
      event.dataTransfer.setData('text/plain', preset.name);
    });
    groupElement.append(button);
  }

  elements.presets.append(groupElement);
}

function updatePresetSelection() {
  for (const button of elements.presets.querySelectorAll('[data-preset-id]')) {
    button.classList.toggle('active', button.dataset.presetId === state.selectedPreset?.id);
  }
}

function applyGridSizeFromControls() {
  applyDesignSettingsPatch({
    gridPreset: elements.gridPreset.value,
    width: Number(elements.gridWidth.value),
    height: Number(elements.gridHeight.value),
    wrapping: elements.wrapToggle.checked,
  }, { resizeBoard: true });
  elements.activeNote.textContent = `Dev grid updated: ${state.board.width} x ${state.board.height}.`;
  elements.devOutput.textContent = `Grid reset to ${state.board.width} x ${state.board.height}.`;
  showToast('Grid updated', { kind: 'success' });
}

function updateDesignStyleFromControls() {
  applyDesignSettingsPatch({
    wrapping: elements.wrapToggle.checked,
    renderStyle: elements.renderStyle.value,
    trailIntensity: elements.trailIntensity.value,
    backgroundColor: elements.backgroundColor.value,
    gridColor: elements.gridColor.value,
    liveCellColor: elements.liveCellColor.value,
    trailCellColor: elements.trailCellColor.value,
    accentColor: elements.accentColor.value,
    selectionColor: elements.selectionColor.value,
  }, { resizeBoard: false });
  elements.devOutput.textContent = getDesignSettingSummary(getCurrentDesignSettings());
}

function openDevProject(creationId) {
  const creation = community.findCreation(creationId);
  if (!creation) return;

  loadCommunityCreation(creationId);
  startDevProject('design', {
    title: creation.title,
    creationId: creation.id,
    source: creation.remixedFromId ? findCommunityDesign(creation.remixedFromId) : null,
    boardLoaded: true,
    openTools: true,
  });
  setDesignMetadataFields(creation);
}

function loadTutorial(tutorial) {
  if (!tutorial) return;

  if (!tutorial.patternId) {
    elements.tutorialOutput.textContent = `${tutorial.title}: ${tutorial.goal}`;
    elements.devOutput.textContent = `${tutorial.title} is a reference lesson. Open the source, then build your version here.`;
    showToast('Reference lesson selected', { kind: 'info' });
    return;
  }

  const preset = presets.find((candidate) => candidate.id === tutorial.patternId);
  if (!preset) return;

  loadPreset(preset);
  setTool('draw');
  elements.tutorialOutput.textContent = `${tutorial.goal} Try: ${tutorial.modifyPrompt}`;
  elements.devOutput.textContent = `Loaded ${tutorial.title}. Modify it, then save your variation as a draft.`;
  markDesignDirty(true);
  showToast(`Loaded ${tutorial.title}`, { kind: 'success' });
}

function bindEvents() {
  window.addEventListener('resize', () => {
    resizeCanvas();
    render();
  });

  canvas.addEventListener('pointerdown', (event) => {
    canvas.setPointerCapture(event.pointerId);
    state.pointer.active = true;
    const wantsPan = state.tool === 'pan' || event.button === 1 || event.shiftKey || event.getModifierState?.(' ');
    state.pointer.mode = wantsPan
      ? 'pan'
      : state.tool === 'draw'
      ? getLiveToolAction({ playing: state.playing, alive: getCellAliveAt(event.clientX, event.clientY) })
      : state.tool;
    state.pointer.lastCell = null;
    state.pointer.lastX = event.clientX;
    state.pointer.lastY = event.clientY;

    if (state.pointer.mode === 'pan') {
      document.querySelector('.app-shell').classList.add('is-panning');
      elements.activeNote.textContent = getToolStatusMessage({ tool: 'pan' });
      return;
    }

    applyToolAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointermove', (event) => {
    state.hoverCell = screenToCell(event.clientX, event.clientY);

    if (!state.pointer.active) return;
    if (state.pointer.mode === 'pan') {
      state.panX += event.clientX - state.pointer.lastX;
      state.panY += event.clientY - state.pointer.lastY;
      state.pointer.lastX = event.clientX;
      state.pointer.lastY = event.clientY;
      return;
    }
    if (state.pointer.mode === 'stamp') return;

    applyToolAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointerup', (event) => {
    canvas.releasePointerCapture(event.pointerId);
    state.pointer.active = false;
    state.pointer.lastCell = null;
    document.querySelector('.app-shell').classList.remove('is-panning');
  });

  canvas.addEventListener('pointerleave', () => {
    state.hoverCell = null;
    document.querySelector('.app-shell').classList.remove('is-panning');
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const action = getWheelAction(event);
    if (action.type === 'zoom') {
      setZoom(state.zoom * action.zoomDelta, event.clientX, event.clientY);
      return;
    }
    state.panX += action.panX;
    state.panY += action.panY;
  }, { passive: false });

  canvas.addEventListener('dragover', (event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
  });

  canvas.addEventListener('drop', (event) => {
    event.preventDefault();
    const presetId = event.dataTransfer.getData('text/life-preset-id');
    const preset = presets.find((candidate) => candidate.id === presetId);

    if (!preset) return;

    state.selectedPreset = preset;
    const cell = screenToCell(event.clientX, event.clientY);
    stampPattern(cell.x, cell.y);
    updatePresetSelection();
  });

  elements.playToggle.addEventListener('click', () => {
    state.playing = !state.playing;
    updatePlayButton();
  });

  elements.step.addEventListener('click', () => {
    stepSimulation();
  });

  elements.clear.addEventListener('click', () => {
    clearWorld();
  });

  elements.randomize.addEventListener('click', () => {
    randomSoup();
  });

  elements.toolDrawerToggle?.addEventListener('click', () => {
    setToolDrawerOpen(!state.toolDrawerOpen);
    if (state.toolDrawerOpen) elements.toolDrawerClose?.focus({ preventScroll: true });
  });

  elements.toolDrawerClose?.addEventListener('click', () => {
    setToolDrawerOpen(false);
    elements.toolDrawerToggle?.focus({ preventScroll: true });
  });

  elements.devCreateDesign?.addEventListener('click', () => {
    startDevProject('design', { title: 'Untitled Design', openTools: false });
  });

  elements.devCreateProject?.addEventListener('click', () => {
    startDevProject('project', { title: 'Untitled Project', openTools: false });
  });

  elements.devDesignTitle?.addEventListener('input', () => {
    setDesignTitle(elements.devDesignTitle.value);
    markDesignDirty(true);
    elements.activeNote.textContent = `Renamed draft to ${elements.devDesignTitle.value || 'Untitled design'}.`;
  });
  elements.devDesignDescription?.addEventListener('input', () => {
    elements.creationDescription.value = elements.devDesignDescription.value;
    markDesignDirty(true);
  });
  elements.devDesignTags?.addEventListener('input', () => {
    elements.creationTags.value = elements.devDesignTags.value;
    markDesignDirty(true);
  });
  elements.devDesignAttribution?.addEventListener('input', () => markDesignDirty(true));
  elements.devDesignTutorial?.addEventListener('input', () => markDesignDirty(true));

  elements.stampRotateLeft?.addEventListener('click', () => rotateStamp(-90));
  elements.stampRotateRight?.addEventListener('click', () => rotateStamp(90));
  elements.stampFlip?.addEventListener('click', flipStamp);
  elements.stampOff?.addEventListener('click', turnStampOff);
  elements.playgroundTutorialNext?.addEventListener('click', advancePlaygroundIntro);
  elements.playgroundTutorialSkip?.addEventListener('click', closePlaygroundIntro);
  elements.playgroundTutorial?.addEventListener('click', (event) => {
    if (event.target.closest('button')) return;
    advancePlaygroundIntro();
  });

  elements.speed.addEventListener('input', () => {
    setSpeed(Number(elements.speed.value));
    state.designSettings = mergeDesignSettings(state.designSettings, { speed: state.speed });
    markDesignDirty(true);
  });

  elements.zoom.addEventListener('input', () => {
    setZoom(Number(elements.zoom.value) / 100);
    state.designSettings = mergeDesignSettings(state.designSettings, { zoom: state.zoom });
    markDesignDirty(true);
  });

  elements.ageColors.addEventListener('change', () => {
    state.ageColors = elements.ageColors.checked;
  });

  elements.modePlayground.addEventListener('click', () => setMode('playground'));

  elements.modeDev.addEventListener('click', () => {
    state.devProjectActive = Boolean(state.activeDesignSession);
    setMode('dev');
  });

  elements.modeCommunity.addEventListener('click', () => setMode('community'));

  elements.saveProfile.addEventListener('click', () => saveLocalProfile());

  elements.sendMagicLink.addEventListener('click', () => {
    sendCommunityMagicLink();
  });

  elements.communitySignOut.addEventListener('click', () => {
    signOutCommunity();
  });

  elements.saveCreation.addEventListener('click', () => saveCurrentCreation());

  elements.publishCreation.addEventListener('click', () => publishActiveCreation());

  elements.saveDesign.addEventListener('click', () => saveCurrentCreation());

  elements.publishDesign.addEventListener('click', () => publishActiveCreation());
  elements.unpublishDesign?.addEventListener('click', unpublishActiveCreation);
  elements.archiveDesign?.addEventListener('click', archiveActiveCreation);
  elements.deleteDesign?.addEventListener('click', deleteActiveCreation);
  elements.devVersionList?.addEventListener('click', (event) => {
    const button = event.target.closest('[data-restore-version-id]');
    if (button && !button.disabled) restoreActiveVersion(button.dataset.restoreVersionId);
  });

  elements.copySharePayload.addEventListener('click', () => {
    copySharePayload();
  });

  elements.communityList.addEventListener('click', handleCommunityAction);
  elements.trendingList.addEventListener('click', handleCommunityAction);
  elements.communityFamousList.addEventListener('click', handleCommunityAction);
  elements.communityRemixList.addEventListener('click', handleCommunityAction);
  elements.communityDetail.addEventListener('click', handleCommunityAction);
  elements.postComment.addEventListener('click', postCommunityComment);

  elements.communitySearch.addEventListener('input', () => {
    state.communitySearch = elements.communitySearch.value;
    renderCommunity();
  });

  elements.communityFilter.addEventListener('change', () => {
    setCommunityFilter(elements.communityFilter.value);
  });

  elements.communityFilterButton?.addEventListener('click', () => {
    const expanded = elements.communityFilterButton.getAttribute('aria-expanded') === 'true';
    elements.communityFilterButton.setAttribute('aria-expanded', String(!expanded));
    elements.communityFilterMenu?.classList.toggle('open', !expanded);
  });

  elements.communityFilterButton?.addEventListener('keydown', (event) => {
    if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
    event.preventDefault();
    elements.communityFilterButton.setAttribute('aria-expanded', 'true');
    elements.communityFilterMenu?.classList.add('open');
    const options = [...elements.communityFilterOptions];
    options[event.key === 'ArrowDown' ? 0 : options.length - 1]?.focus();
  });

  elements.communityFilterMenu?.addEventListener('keydown', (event) => {
    const options = [...elements.communityFilterOptions];
    const currentIndex = options.indexOf(document.activeElement);

    if (event.key === 'Escape') {
      event.preventDefault();
      elements.communityFilterButton?.setAttribute('aria-expanded', 'false');
      elements.communityFilterMenu?.classList.remove('open');
      elements.communityFilterButton?.focus();
      return;
    }

    const movement = {
      ArrowDown: Math.min(options.length - 1, currentIndex + 1),
      ArrowUp: Math.max(0, currentIndex - 1),
      Home: 0,
      End: options.length - 1,
    }[event.key];
    if (movement === undefined) return;
    event.preventDefault();
    options[movement]?.focus();
  });

  for (const option of elements.communityFilterOptions) {
    option.addEventListener('click', () => {
      elements.communityFilterButton?.setAttribute('aria-expanded', 'false');
      elements.communityFilterMenu?.classList.remove('open');
      setCommunityFilter(option.dataset.communityFilterValue);
      elements.communityFilterButton?.focus({ preventScroll: true });
    });
  }

  document.addEventListener('click', (event) => {
    if (!event.target.closest('[data-custom-select="community-filter"]')) {
      elements.communityFilterButton?.setAttribute('aria-expanded', 'false');
      elements.communityFilterMenu?.classList.remove('open');
    }
  });

  for (const button of elements.speedStepButtons) {
    button.addEventListener('click', () => {
      setSpeed(state.speed + Number(button.dataset.speedStep));
      state.designSettings = mergeDesignSettings(state.designSettings, { speed: state.speed });
      markDesignDirty(true);
    });
  }

  for (const button of elements.zoomStepButtons) {
    button.addEventListener('click', () => {
      setZoom((Number(elements.zoom.value) + Number(button.dataset.zoomStep)) / 100);
      state.designSettings = mergeDesignSettings(state.designSettings, { zoom: state.zoom });
      markDesignDirty(true);
    });
  }

  for (const button of elements.devComponentButtons) {
    button.addEventListener('click', () => selectDevComponent(button.dataset.devComponent));
  }

  for (const button of elements.devDemoButtons) {
    button.addEventListener('click', () => runDevDemo(button.dataset.devDemo));
  }

  for (const button of elements.devClaimButtons) {
    button.addEventListener('click', () => runDevClaim(button.dataset.devClaim));
  }

  elements.applyGridSize.addEventListener('click', applyGridSizeFromControls);
  elements.gridPreset.addEventListener('change', () => {
    const preset = createDesignSettings({ gridPreset: elements.gridPreset.value });
    elements.gridWidth.value = preset.width;
    elements.gridHeight.value = preset.height;
  });
  elements.wrapToggle.addEventListener('change', updateDesignStyleFromControls);
  elements.renderStyle.addEventListener('change', updateDesignStyleFromControls);
  elements.trailIntensity.addEventListener('change', updateDesignStyleFromControls);
  elements.backgroundColor.addEventListener('input', updateDesignStyleFromControls);
  elements.gridColor.addEventListener('input', updateDesignStyleFromControls);
  elements.liveCellColor.addEventListener('input', updateDesignStyleFromControls);
  elements.trailCellColor.addEventListener('input', updateDesignStyleFromControls);
  elements.accentColor.addEventListener('input', updateDesignStyleFromControls);
  elements.selectionColor.addEventListener('input', updateDesignStyleFromControls);
  elements.devProjectList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-dev-project-id]');
    if (button) openDevProject(button.dataset.devProjectId);
  });
  elements.tutorialGroups.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tutorial-group]');
    if (!button) return;
    state.activeTutorialGroup = button.dataset.tutorialGroup;
    renderTutorials();
  });
  elements.tutorialList.addEventListener('click', (event) => {
    const button = event.target.closest('[data-tutorial-title]');
    if (!button) return;
    const tutorial = tutorialCatalog.find((candidate) => candidate.title === button.dataset.tutorialTitle);
    loadTutorial(tutorial);
  });

  elements.importRle.addEventListener('click', () => {
    importRle();
  });

  elements.exportRle.addEventListener('click', () => {
    exportRle();
  });

  for (const button of elements.toolButtons) {
    button.addEventListener('click', () => chooseTool(button.dataset.tool));
  }

  window.addEventListener('keydown', (event) => {
    if (event.target instanceof HTMLInputElement || event.target instanceof HTMLTextAreaElement) return;

    if (event.key === ' ') {
      event.preventDefault();
      state.playing = !state.playing;
      updatePlayButton();
    }
    if (event.key === '.') stepSimulation();
    if (event.key === '1') chooseTool('draw');
    if (event.key === '2') chooseTool('stamp');
  });
  window.addEventListener('offline', () => {
    if (state.designDirty) setSaveStatus('offline');
  });
  window.addEventListener('online', () => {
    if (state.designDirty) setSaveStatus('dirty');
  });
  window.addEventListener('beforeunload', (event) => {
    if (!state.designDirty || !state.recoveryFailed) return;
    event.preventDefault();
    event.returnValue = '';
  });
}

function loop(timestamp) {
  if (!state.lastTick) state.lastTick = timestamp;
  const delta = timestamp - state.lastTick;
  state.lastTick = timestamp;

  if (state.playing) {
    state.accumulator += delta;
    const interval = 1000 / state.speed;

    while (state.accumulator >= interval) {
      stepSimulation();
      state.accumulator -= interval;
    }
  } else {
    for (let i = 0; i < state.trail.length; i += 1) {
      if (!state.board.cells[i] && state.trail[i] > 0) state.trail[i] = Math.floor(state.trail[i] * 0.98);
    }
  }

  render();
  requestAnimationFrame(loop);
}

function boot() {
  resizeCanvas();
  centerWorld();
  renderPresets();
  renderCommunity();
  updateStats();
  updatePlayButton();
  setMode('playground');
  bindEvents();
  clearWorld();
  markDesignDirty(false);
  const recoveredDraft = restoreLocalRecovery();
  importSharedBuildFromHash();
  initializeCommunityBackend();
  mountLandingIntro({
    layer: elements.introLayer,
    canvas: elements.introCanvas,
    prompt: elements.introPrompt,
    startButton: elements.introStart,
    skipButton: elements.introSkip,
    title: elements.introCardTitle,
    help: elements.introHelp,
    profileFields: elements.introProfileFields,
    onPlayground: () => {
      if (recoveredDraft && !window.location.hash) {
        setMode('dev');
        elements.devOutput.textContent = 'Recovered your unsaved local draft. Save it when you are ready.';
        return;
      }
      setMode('playground');
      window.setTimeout(openPlaygroundIntro, 940);
    },
    onDevelop: async () => {
      const saved = await saveIntroProfileFromFields({ requireProfile: true });
      if (saved) setMode('dev');
      return saved;
    },
  });
  requestAnimationFrame(loop);
}

boot();

function findPreset(id) {
  const preset = presets.find((candidate) => candidate.id === id);

  if (!preset) {
    throw new Error(`Missing required preset: ${id}`);
  }

  return preset;
}
