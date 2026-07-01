const LIFEWIKI = 'https://conwaylife.com/wiki';

const GROUPS = [
  {
    id: 'starter',
    title: 'Starter',
    note: 'Small still lifes, oscillators, spaceships, and methuselahs.',
  },
  {
    id: 'builder',
    title: 'Builder',
    note: 'Signals, guns, collisions, eaters, reflectors, rakes, and puffers.',
  },
  {
    id: 'masterworks',
    title: 'Masterworks',
    note: 'Large-scale discoveries and advanced construction ideas.',
  },
];

const TUTORIALS = [
  tutorial({
    group: 'starter',
    title: 'Block stability',
    patternId: 'block',
    sourceUrl: `${LIFEWIKI}/Block`,
    goal: 'See why a 2 x 2 still life has no births and no deaths.',
    steps: ['Load the block.', 'Step three times.', 'Watch every live cell keep two or three neighbors.'],
    modifyPrompt: 'Attach one extra cell to a corner and find when the block recovers.',
  }),
  tutorial({
    group: 'starter',
    title: 'Blinker period',
    patternId: 'blinker',
    sourceUrl: `${LIFEWIKI}/Blinker`,
    goal: 'Measure the smallest oscillator and recognize period-2 timing.',
    steps: ['Load the blinker.', 'Step once.', 'Step again and compare with the start.'],
    modifyPrompt: 'Place two blinkers near each other and try to keep them independent.',
  }),
  tutorial({
    group: 'starter',
    title: 'Beacon corner spark',
    patternId: 'beacon',
    sourceUrl: `${LIFEWIKI}/Beacon`,
    goal: 'Use a period-2 oscillator to understand edge sparks.',
    steps: ['Load the beacon.', 'Watch the touching corners appear and vanish.', 'Use the population graph to spot the rhythm.'],
    modifyPrompt: 'Move a block near the beacon and look for stable debris.',
  }),
  tutorial({
    group: 'starter',
    title: 'Pulsar rhythm',
    patternId: 'pulsar',
    sourceUrl: `${LIFEWIKI}/Pulsar`,
    goal: 'Read a period-3 oscillator with symmetry.',
    steps: ['Load the pulsar.', 'Step through three generations.', 'Notice the same outline returning.'],
    modifyPrompt: 'Delete a symmetric arm and compare collapse speed.',
  }),
  tutorial({
    group: 'starter',
    title: 'Glider drift',
    patternId: 'glider',
    sourceUrl: `${LIFEWIKI}/Glider`,
    goal: 'Track a small spaceship as it translates diagonally.',
    steps: ['Load the glider.', 'Step four times.', 'Run the drift check in Dev Studio.'],
    modifyPrompt: 'Stamp a second glider nearby and create a collision.',
  }),
  tutorial({
    group: 'starter',
    title: 'Lightweight spaceship lane',
    patternId: 'lwss',
    sourceUrl: `${LIFEWIKI}/Lightweight_spaceship`,
    goal: 'Compare horizontal spaceship motion against glider motion.',
    steps: ['Load the lightweight spaceship.', 'Run at slow speed.', 'Watch the lane stay coherent.'],
    modifyPrompt: 'Place a still life in the lane and see what debris survives.',
  }),
  tutorial({
    group: 'starter',
    title: 'R-pentomino chaos',
    patternId: 'r-pentomino',
    sourceUrl: `${LIFEWIKI}/R-pentomino`,
    goal: 'Watch a tiny seed create long-lived chaos before settling.',
    steps: ['Load the R-pentomino.', 'Run for several hundred generations.', 'Use the graph to see the burst.'],
    modifyPrompt: 'Change one live cell and compare how long it stays active.',
  }),
  tutorial({
    group: 'starter',
    title: 'Acorn growth',
    patternId: 'acorn',
    sourceUrl: `${LIFEWIKI}/Acorn`,
    goal: 'Study a seven-cell methuselah with a long chaotic life.',
    steps: ['Load Acorn.', 'Increase the grid size.', 'Run and watch late-stage cleanup.'],
    modifyPrompt: 'Try bounded edges and compare the final debris.',
  }),
  tutorial({
    group: 'starter',
    title: 'Diehard extinction',
    patternId: 'diehard',
    sourceUrl: `${LIFEWIKI}/Diehard`,
    goal: 'See a pattern that lives for many generations and then disappears.',
    steps: ['Load Diehard.', 'Run it at medium speed.', 'Watch population finally hit zero.'],
    modifyPrompt: 'Add one block nearby and try to prevent extinction.',
  }),
  tutorial({
    group: 'builder',
    title: 'Gosper glider gun',
    patternId: 'gosper-gun',
    sourceUrl: `${LIFEWIKI}/Gosper_glider_gun`,
    goal: 'Build with a repeating source that emits gliders.',
    steps: ['Load the gun.', 'Run at 10 generations per second.', 'Trace the stream lane to the right.'],
    modifyPrompt: 'Place an eater or block in the stream and inspect the reaction.',
  }),
  tutorial({
    group: 'builder',
    title: 'Signal collision pair',
    patternId: 'glider-pair',
    sourceUrl: `${LIFEWIKI}/Glider`,
    goal: 'Use two gliders as a small logic experiment.',
    steps: ['Load the pair.', 'Step slowly.', 'Watch the collision produce or remove debris.'],
    modifyPrompt: 'Offset one glider by a cell and compare the output.',
  }),
  tutorial({
    group: 'builder',
    title: 'Gun battery stream',
    patternId: 'gun-battery',
    sourceUrl: `${LIFEWIKI}/Gosper_glider_gun`,
    goal: 'Layer multiple guns into a repeatable signal wall.',
    steps: ['Load the battery.', 'Zoom out.', 'Look for synchronized stream spacing.'],
    modifyPrompt: 'Change the spacing between guns and find collisions.',
  }),
  tutorial({
    group: 'builder',
    title: 'Puffer and rake idea',
    patternId: 'glider-fleet',
    sourceUrl: `${LIFEWIKI}/Rake`,
    goal: 'Recognize moving patterns that leave or emit other patterns.',
    steps: ['Load the glider fleet.', 'Run with trails on.', 'Follow each moving object.'],
    modifyPrompt: 'Create a second fleet moving into the first.',
  }),
  tutorial({
    group: 'builder',
    title: 'Simkin glider gun reference',
    sourceUrl: `${LIFEWIKI}/Simkin_glider_gun`,
    goal: 'Compare a later compact gun design with the Gosper gun.',
    steps: ['Open the reference.', 'Recreate the idea from smaller components.', 'Save your approximation as a draft.'],
    modifyPrompt: 'Use the Gosper gun as a stand-in and design a smaller output lane.',
  }),
  tutorial({
    group: 'builder',
    title: 'Snark reflector reference',
    sourceUrl: `${LIFEWIKI}/Snark`,
    goal: 'Understand why stable reflectors matter for reusable signal paths.',
    steps: ['Open the reference.', 'Study the input/output idea.', 'Experiment with glider collisions first.'],
    modifyPrompt: 'Build a simple two-glider reflection experiment.',
  }),
  tutorial({
    group: 'masterworks',
    title: 'OTCA metapixel',
    sourceUrl: `${LIFEWIKI}/OTCA_metapixel`,
    goal: 'See how Life can simulate Life at a huge scale.',
    steps: ['Open the reference.', 'Compare one metacell to a normal cell.', 'Think in layers instead of single cells.'],
    modifyPrompt: 'Make a miniature visual homage with large custom grid settings.',
  }),
  tutorial({
    group: 'masterworks',
    title: 'Gemini-style self-replication',
    sourceUrl: `${LIFEWIKI}/Gemini`,
    goal: 'Introduce the idea of self-replicating Life machines.',
    steps: ['Open the reference.', 'Read the construction goal.', 'Use Dev Studio metadata to document a simplified model.'],
    modifyPrompt: 'Create a tiny pattern that copies a visual motif, even if not a true replicator.',
  }),
  tutorial({
    group: 'masterworks',
    title: 'Sir Robin-style advanced spaceships',
    sourceUrl: `${LIFEWIKI}/Sir_Robin`,
    goal: 'Explore modern large spaceship discoveries.',
    steps: ['Open the reference.', 'Compare its scale with LWSS.', 'Use zoom and custom grid size to plan lanes.'],
    modifyPrompt: 'Build a spaceship gallery with LWSS and glider families.',
  }),
  tutorial({
    group: 'masterworks',
    title: 'Pattern of the Year discoveries',
    sourceUrl: `${LIFEWIKI}/Pattern_of_the_Year`,
    goal: 'Browse major recent discoveries and use them as remix prompts.',
    steps: ['Open the reference.', 'Choose a discovery.', 'Write a Dev Studio note explaining the idea.'],
    modifyPrompt: 'Publish a community design inspired by one discovery with attribution.',
  }),
];

export function getTutorialCatalog() {
  return TUTORIALS.map((tutorialEntry) => ({
    ...tutorialEntry,
    steps: [...tutorialEntry.steps],
  }));
}

export function getTutorialGroups() {
  return GROUPS.map((group) => ({ ...group }));
}

export function getTutorialsByGroup(groupId) {
  return getTutorialCatalog().filter((tutorialEntry) => tutorialEntry.group === groupId);
}

function tutorial(input) {
  return {
    group: input.group,
    title: input.title,
    patternId: input.patternId || null,
    sourceUrl: input.sourceUrl,
    goal: input.goal,
    steps: input.steps,
    modifyPrompt: input.modifyPrompt,
  };
}
