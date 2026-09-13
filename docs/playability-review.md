# Live playability correction — 2026-09-13

The user challenged the earlier completion assessment. A fresh guest
playthrough of the deployed app on desktop (1440 × 900) and mobile (390 × 844)
found visible defects that previous acceptance tests had missed.

## Corrected and deployed

- Removed invented preset star, remix and view counts. Presets are explicitly
  attributed to their source rather than presented as user publications.
- Small previews no longer upscale coordinates into disconnected dots. Cells
  retain square proportions, and decorative background circles are removed.
- Community card Remix uses the working guest remix flow. Removed the duplicate
  detail action and the profile prerequisite from that entry point.
- Studio entry clears the fixed header. Removed unsolicited profile-field
  focus and misleading text saying a profile is necessary to save drafts.
- On the configured live app, Studio's Create Account opens the real account
  dialog instead of submitting the legacy name/email-only local profile form.
- Pattern names and metadata wrap within cards; Community buttons fit.
- Phone simulation controls occupy under 160 px instead of about 217 px.
- Built-in presets do not offer unsupported reporting/commenting; creators and
  unavailable routes do not show a comment box for an unrelated creation.
- Source attribution without a creator username is plain text, not an inert
  profile button.

## Evidence

Used the repository's permitted Playwright fallback because the Browser skill's
required JavaScript tool is not exposed in this session. This is real Chromium
interaction with the live site, not a source-only review.

- `npm test`: 195 passed, two environment skips, zero failures.
- Workspace and new playability browser tests: 22 passed, two intentional
  mobile skips. After the additional preset/comment corrections, the four
  focused playability tests passed again.
- Live `playability.spec.js`: four passed (desktop/mobile). Verifies signup
  dialog entry, header clearance, actual glider geometry, no invented counts,
  guest Remix, Step, Reset, reload persistence and mobile control height.
- Additional live playthrough: Play advances beyond generation five, Pause and
  Reset, Studio entry/new design/tool drawer, Community. No page errors.
- Inspected final live screenshots:
  `/private/tmp/life-fixed-desktop-community.png`,
  `/private/tmp/life-fixed-desktop-studio-start.png`,
  `/private/tmp/life-fixed-mobile-start.png`.
- Browser test artifacts: `/private/tmp/life-playability-live`.
- `node --check src/app.js` and `git diff --check` passed.

Deployment: `npm run deploy:worker` succeeded. Worker version
`2180e7ac-9b4f-4f6f-a60a-11c1fa075acf` serves the live app. Previous version
`c88e2698-d13f-42c9-838b-a9e82a438452` is the application rollback reference.
No database migration or production account/content writes were performed.

This pass fixes the reproduced problems; it is not an exhaustive usability
certification. Safari/Firefox, tablet widths and the authenticated two-user
journey were not freshly exercised. Earlier release evidence remains historical.
LinkedIn publication stays on hold and requires the user's review and explicit
approval of the final post.
