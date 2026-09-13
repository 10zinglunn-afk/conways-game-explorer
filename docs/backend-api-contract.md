# T2 backend handoff

This file records the implemented server boundary for T4 and T5. The normative
product rules remain in `integration-contracts.md`.

All community calls use same-origin cookies. Errors are
`{ error, code, issues?, retryAfter? }`, and the browser proxy retains those
fields on the thrown `Error`. Public projects expose the immutable published
version and metadata snapshot. Owner state exposes the editable head and full
version history.

## Guest claim calls

1. `POST /api/community/imports` with `importKey`, `localProjectId`,
   `capturedRevision`, `project`, `currentLocalVersionId`,
   `totalVersionCount`, and `manifestDigest`.
2. `PUT /api/community/imports/:id/manifest/:batch` with `{ entries, digest }`.
   One batch contains at most 40 entries describing at most 20,000,000 bytes.
3. `PUT /api/community/imports/:id/versions/:localVersionId` with
   `{ offset, totalBytes, digest, data, metadata }`. `data` is an RLE text chunk;
   offsets and sizes are UTF-8 byte counts. Upload chunks sequentially. The
   response reports `receivedBytes` and `receivedRanges` for resume.
4. `POST /api/community/imports/:id/complete`. New completion returns 201;
   an idempotent retry returns 200 with the same project and local-to-cloud ID
   mapping.

Every digest is lowercase SHA-256 hex. Version digests cover the exact UTF-8 RLE
bytes. Manifest digests cover canonical JSON: arrays retain order, object keys
are recursively sorted lexicographically, and primitive values use JSON
encoding. The full manifest digest covers all entries in ascending batch order.
Conflicting retries return `IMPORT_CONFLICT`; incomplete uploads remain staged
and invisible. Uploading imports expire after seven inactive days.

The client must capture a project revision before upload. T5 must compare that
revision and digest and persist the cloud mapping in the same IndexedDB
read-write transaction that conditionally removes the captured local revision.
The server never directs the client to delete local data.

## Other browser proxy methods

The PostgreSQL browser repository now exposes public feed/project/profile/comment
reads, pattern favorites, comment create/edit/delete, reports, recovery-key
rotation, password recovery, password-confirmed account deletion, and the four
staged import methods. `saveVersion` accepts `expectedCurrentVersionId` and gets
`STALE_VERSION` on a concurrent head change.

Private RLE is limited to 5 MB. Publication separately enforces 200 KB and
200,000 live cells. Every server write strictly parses B3/S23 RLE and derives
population rather than trusting the request.

### Import retry identity

Completion serializes revisions by authenticated owner and local project ID.
A new captured import key reuses the prior completed cloud project, retains
existing version IDs, and appends only new immutable versions in one transaction.
Previously imported manifest entries must remain unchanged and present. A
deleted/archived project or cloud head newer than the last imported head returns
`IMPORT_CONFLICT`, preserving the local draft. Local IDs never link projects
across owners. Published snapshots remain unchanged by private import updates.

Import completion timestamps are allocated while holding the owner/project
transaction lock. Each is strictly greater than the preceding completed import
(at PostgreSQL microsecond precision), regardless of transaction start order or
a backward wall-clock adjustment. The latest completion therefore identifies
the authoritative imported version mapping.
