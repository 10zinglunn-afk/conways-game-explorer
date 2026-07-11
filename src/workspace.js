const WORKSPACE_PRESENTATION = {
  playground: {
    mode: 'playground',
    activePanel: 'playground',
    showsWorld: true,
    showsTransport: true,
    showsPlaygroundTools: true,
    showsDevTools: false,
    showsCommunityTools: false,
  },
  devStart: {
    mode: 'dev',
    activePanel: 'dev-start',
    showsWorld: false,
    showsTransport: false,
    showsPlaygroundTools: false,
    showsDevTools: true,
    showsCommunityTools: false,
  },
  devProject: {
    mode: 'dev',
    activePanel: 'dev-project',
    showsWorld: true,
    showsTransport: true,
    showsPlaygroundTools: true,
    showsDevTools: true,
    showsCommunityTools: false,
  },
  community: {
    mode: 'community',
    activePanel: 'community',
    showsWorld: false,
    showsTransport: false,
    showsPlaygroundTools: false,
    showsDevTools: false,
    showsCommunityTools: true,
  },
};

export function getWorkspacePresentation(mode, { devProjectActive = false } = {}) {
  if (mode === 'dev') {
    return devProjectActive ? WORKSPACE_PRESENTATION.devProject : WORKSPACE_PRESENTATION.devStart;
  }

  return WORKSPACE_PRESENTATION[mode] || WORKSPACE_PRESENTATION.playground;
}

export function getCommunityActionCopy() {
  return {
    play: 'Play',
    edit: 'Edit Clone',
    star: 'Star',
    share: 'Share',
  };
}

export function getToolDrawerCopy({ open }) {
  return open
    ? {
        label: 'Close Tools',
        ariaLabel: 'Close tools drawer',
      }
    : {
        label: 'Open Tools',
        ariaLabel: 'Open tools drawer',
      };
}
