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
import { addCreationComment } from './community.js';
import { encodeShareLink, decodeShareLink } from './share.js';
import {
  encodeRle,
  getPatternBounds,
  getPresetGroup,
  parseRle,
} from './patterns.js';
import {
  getHapticPattern,
  getLiveToolAction,
  getNextTool,
  getToolAfterWorkspaceChange,
  getToolStatusMessage,
  shouldHideStampPreview,
  getWheelZoomDelta,
} from './interaction.js';
import {
  createDesignSettings,
  getDesignSettingSummary,
  mergeDesignSettings,
  serializeDesignSettings,
} from './design-settings.js';
import {
  getTutorialCatalog,
  getTutorialGroups,
  getTutorialsByGroup,
} from './tutorials.js';
import { mountLandingIntro } from './landing.js';
import { presetGroups, presets } from './presets.js';

const WORLD_WIDTH = 300;
const WORLD_HEIGHT = 200;
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

const canvas = document.querySelector('#world');
const ctx = canvas.getContext('2d', { alpha: false });

const elements = {
  playToggle: document.querySelector('#play-toggle'),
  playLabel: document.querySelector('#play-label'),
  step: document.querySelector('#step'),
  clear: document.querySelector('#clear'),
  randomize: document.querySelector('#randomize'),
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
  generation: document.querySelector('#generation'),
  population: document.querySelector('#population'),
  density: document.querySelector('#density'),
  boardSize: document.querySelector('#board-size'),
  activeNote: document.querySelector('#active-note'),
  toolButtons: document.querySelectorAll('[data-tool]'),
  stampLabel: document.querySelector('[data-stamp-label]'),
  feedbackToast: document.querySelector('#feedback-toast'),
  introLayer: document.querySelector('#intro-layer'),
  introCanvas: document.querySelector('#intro-canvas'),
  introPrompt: document.querySelector('#intro-prompt'),
  introStart: document.querySelector('#intro-start'),
  modePlayground: document.querySelector('#mode-playground'),
  modeDev: document.querySelector('#mode-dev'),
  modeCommunity: document.querySelector('#mode-community'),
  devPanel: document.querySelector('#dev-panel'),
  devOutput: document.querySelector('#dev-output'),
  devDirtyState: document.querySelector('#dev-dirty-state'),
  devProfileName: document.querySelector('#dev-profile-name'),
  devProfileMeta: document.querySelector('#dev-profile-meta'),
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

const state = {
  board: createBoard(DEFAULT_DESIGN_SETTINGS.width, DEFAULT_DESIGN_SETTINGS.height),
  trail: new Uint8Array(DEFAULT_DESIGN_SETTINGS.width * DEFAULT_DESIGN_SETTINGS.height),
  age: new Uint16Array(DEFAULT_DESIGN_SETTINGS.width * DEFAULT_DESIGN_SETTINGS.height),
  populationHistory: [],
  selectedPreset: null,
  playing: false,
  speed: 10,
  zoom: 1,
  mode: 'playground',
  designSettings: DEFAULT_DESIGN_SETTINGS,
  designDirty: false,
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
  if (elements.devDirtyState) {
    elements.devDirtyState.textContent = dirty ? 'Unsaved' : 'Saved';
    elements.devDirtyState.classList.toggle('dirty', dirty);
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
  document.documentElement.style.setProperty('--accent', settings.accentColor);
  document.documentElement.style.setProperty('--accent-strong', settings.liveCellColor);
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
  state.panX = (window.innerWidth - state.board.width * cellSize) / 2;
  state.panY = (window.innerHeight - state.board.height * cellSize) / 2;
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

  const bounds = getPatternBounds(state.selectedPreset.coordinates);
  const originX = cellX - Math.floor(bounds.width / 2);
  const originY = cellY - Math.floor(bounds.height / 2);

  state.board = placePatternForCurrentSettings(state.board, state.selectedPreset.coordinates, originX, originY);
  markLivingCells(255, 1);
  elements.activeNote.textContent = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: state.selectedPreset.name,
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
  elements.activeNote.textContent = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: preset.name,
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
    elements.activeNote.textContent = getToolStatusMessage({
      tool: 'stamp',
      selectedPresetName: state.selectedPreset.name,
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

  const alpha = Math.min(0.16, Math.max(0.04, (cellSize - 4) / 80));
  ctx.strokeStyle = state.designSettings.gridColor;
  ctx.globalAlpha = alpha;
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
  ctx.globalAlpha = 1;
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

  const bounds = getPatternBounds(state.selectedPreset.coordinates);
  const originX = state.hoverCell.x - Math.floor(bounds.width / 2);
  const originY = state.hoverCell.y - Math.floor(bounds.height / 2);
  const inset = cellSize > 8 ? 1 : 0;

  ctx.save();
  ctx.shadowColor = 'rgba(94, 234, 212, 0.52)';
  ctx.shadowBlur = Math.min(18, cellSize);
  ctx.fillStyle = 'rgba(191, 253, 244, 0.28)';
  ctx.strokeStyle = 'rgba(94, 234, 212, 0.72)';
  ctx.lineWidth = Math.max(1, Math.min(2, cellSize * 0.12));

  for (const [patternX, patternY] of state.selectedPreset.coordinates) {
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
  document.querySelector('.app-shell').classList.toggle('stamp-mode', tool === 'stamp');

  for (const button of elements.toolButtons) {
    const active = button.dataset.tool === tool;
    button.classList.toggle('active', active);
    button.setAttribute('aria-checked', String(active));

    if (button.dataset.tool === 'stamp') {
      const label = button.querySelector('[data-stamp-label]');
      if (label) label.textContent = active ? 'Stamp on' : 'Stamp';
      button.setAttribute(
        'aria-label',
        active ? 'Stamp mode on. Click again to turn it off.' : 'Turn on Stamp mode',
      );
      button.title = active ? 'Stamp mode is on. Click again to turn it off.' : 'Turn on Stamp mode';
    }
  }
}

function chooseTool(requestedTool) {
  const wasHidingStamp = shouldHideStampPreview({
    currentTool: state.tool,
    requestedTool,
  });
  const nextTool = getNextTool({
    currentTool: state.tool,
    requestedTool,
  });

  setTool(nextTool);

  if (wasHidingStamp) {
    state.hoverCell = null;
    state.pointer.active = false;
    elements.activeNote.textContent = state.selectedPreset
      ? `Stamp off. ${state.selectedPreset.name} stays selected.`
      : 'Stamp off.';
    triggerHaptic('stampToggle');
    return;
  }

  if (nextTool === 'stamp') {
    elements.activeNote.textContent = getToolStatusMessage({
      tool: 'stamp',
      selectedPresetName: state.selectedPreset?.name,
    });
    triggerHaptic('stampToggle');
  } else {
    elements.activeNote.textContent = getToolStatusMessage({ tool: 'draw' });
  }
}

function setMode(mode) {
  const previousMode = state.mode;
  state.mode = mode;
  const devMode = mode === 'dev';
  const communityMode = mode === 'community';
  const playgroundMode = mode === 'playground';

  if (previousMode !== mode) {
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
  shell.classList.toggle('community-mode', communityMode);
  elements.modePlayground.classList.toggle('active', playgroundMode);
  elements.modeDev.classList.toggle('active', devMode);
  elements.modeCommunity.classList.toggle('active', communityMode);
  elements.modePlayground.setAttribute('aria-current', playgroundMode ? 'page' : 'false');
  elements.modeDev.setAttribute('aria-current', devMode ? 'page' : 'false');
  elements.modeCommunity.setAttribute('aria-current', communityMode ? 'page' : 'false');

  if (devMode) {
    renderDevStudio();
    elements.activeNote.textContent = 'Dev Mode: stamp components, run checks, and treat gliders as signals.';
  } else if (communityMode) {
    renderCommunity();
    elements.activeNote.textContent = 'Community Mode: save this board, publish it, clone builds, and watch what trends.';
  } else {
    elements.activeNote.textContent = 'Playground Mode: explore, draw, stamp presets, and watch the world evolve.';
  }
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
  elements.devOutput.textContent = `${component.name} ready. Stamp is on for repeated placement.`;
  elements.activeNote.textContent = getToolStatusMessage({
    tool: 'stamp',
    selectedPresetName: component.name,
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
    elements.communityOutput.textContent = isCloudCommunityActive()
      ? `Cloud profile saved for ${profile.displayName}.`
      : `Signed in locally as ${profile.displayName}.`;
  } catch (error) {
    elements.communityOutput.textContent = `Could not save profile: ${getErrorMessage(error)}`;
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
  let creation;
  try {
    creation = await community.saveCreation({
      title: elements.creationTitle.value || getSuggestedCreationTitle(),
      description: elements.creationDescription.value,
      tags: elements.creationTags.value,
      rle: encodeRle(coordinates),
      width: state.board.width,
      height: state.board.height,
      generation: state.board.generation,
      population: coordinates.length,
      thumbnail: captureBoardThumbnail(),
      settings: getCurrentDesignSettings(),
    }, { publish });
  } catch (error) {
    elements.communityOutput.textContent = error.name === 'QuotaExceededError'
      ? 'Could not save: browser storage is full. Remove some builds and try again.'
      : `Could not save: ${getErrorMessage(error)}`;
    return null;
  }

  syncCommunity();
  markDesignDirty(false);
  triggerHaptic('save');
  showToast(publish ? 'Published to Community' : 'Draft saved', { kind: 'success' });
  elements.communityOutput.textContent = publish
    ? `Published ${creation.title}. It now appears in Trending.`
    : `Saved ${creation.title} as a private draft.`;
  elements.devOutput.textContent = publish
    ? `Published ${creation.title} to Community.`
    : `Saved ${creation.title} as a draft.`;

  return creation;
}

function hasPublishMetadata() {
  return Boolean(
    elements.creationTitle.value.trim()
      && elements.creationDescription.value.trim()
      && elements.creationTags.value.trim(),
  );
}

async function publishActiveCreation() {
  await saveCurrentCreation({ publish: true });
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

function renderDevStudio() {
  if (!elements.devPanel) return;

  const profile = communityState.profile;
  const creations = profile
    ? communityState.creations.filter((creation) => creation.ownerId === profile.id)
    : communityState.creations;
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
  renderProjectList(creations);
  renderTutorials();
  syncDesignControls();
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
    const starred = communityState.profile && creation.starredBy?.includes(communityState.profile.id);
    card.innerHTML = `
      <button class="community-preview" type="button" data-community-action="detail" data-creation-id="${creation.id}" aria-label="View ${escapeHtml(creation.title)}"></button>
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
        <button type="button" data-community-action="open-playground" data-creation-id="${creation.id}">Open</button>
        <button type="button" data-community-action="star" data-creation-id="${creation.id}">${starred ? 'Unstar' : 'Star'}</button>
        <button type="button" data-community-action="copy" data-creation-id="${creation.id}">Copy</button>
        <button type="button" data-community-action="remix" data-creation-id="${creation.id}">Remix</button>
      </div>
    `;
    container.append(card);
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
  const lineage = creation.remixedFromId
    ? `Based on ${creation.remixedFromId}`
    : 'Original or historical design';

  elements.communityDetail.innerHTML = `
    <div class="detail-preview" aria-hidden="true"></div>
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
      <button type="button" data-community-action="open-playground" data-creation-id="${creation.id}">Open in Playground</button>
      <button type="button" data-community-action="open-dev" data-creation-id="${creation.id}">Open in Dev Studio</button>
      <button type="button" data-community-action="copy" data-creation-id="${creation.id}">Copy</button>
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
    return;
  }

  if (communityAction === 'open-playground') {
    openCommunityDesign(creationId, 'playground');
    return;
  }

  if (communityAction === 'open-dev') {
    openCommunityDesign(creationId, 'dev');
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

function openCommunityDesign(creationId, mode) {
  const creation = findCommunityDesign(creationId);
  if (!creation) return;

  loadCreationOntoBoard(creation, { center: true });
  state.selectedCommunityId = creationId;
  elements.communityOutput.textContent = `Opened ${creation.title}.`;
  showToast(`Opened ${creation.title}`, { kind: 'success' });
  setMode(mode);
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
        title: `${creation.title} Remix`,
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
      <span class="preset-name">${preset.name}</span>
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
  loadCommunityCreation(creationId);
  setMode('dev');
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
    state.pointer.mode = state.tool === 'draw'
      ? getLiveToolAction({ playing: state.playing, alive: getCellAliveAt(event.clientX, event.clientY) })
      : state.tool;
    state.pointer.lastCell = null;
    state.pointer.lastX = event.clientX;
    state.pointer.lastY = event.clientY;

    applyToolAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointermove', (event) => {
    state.hoverCell = screenToCell(event.clientX, event.clientY);

    if (!state.pointer.active) return;
    if (state.pointer.mode === 'stamp') return;

    applyToolAt(event.clientX, event.clientY);
  });

  canvas.addEventListener('pointerup', (event) => {
    canvas.releasePointerCapture(event.pointerId);
    state.pointer.active = false;
    state.pointer.lastCell = null;
  });

  canvas.addEventListener('pointerleave', () => {
    state.hoverCell = null;
  });

  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    setZoom(state.zoom * getWheelZoomDelta(event), event.clientX, event.clientY);
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

  elements.modeDev.addEventListener('click', () => setMode('dev'));

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
    state.communityFilter = elements.communityFilter.value;
    renderCommunity();
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
  importSharedBuildFromHash();
  initializeCommunityBackend();
  mountLandingIntro({
    layer: elements.introLayer,
    canvas: elements.introCanvas,
    prompt: elements.introPrompt,
    startButton: elements.introStart,
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
