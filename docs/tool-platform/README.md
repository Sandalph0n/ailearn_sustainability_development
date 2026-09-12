# Lernumi Tool Platform Contract

Status: **v1 implemented**

Runtime API base path: **`/api/tool/v1`**

This contract lets an independently built browser application run as a Lernumi tool. The
platform authenticates the launch, pins the exact uploaded version, owns workspace persistence,
stores opaque event batches, and decides whether replay is available. The tool owns its editor,
event format, and replay renderer.

The two normative artifacts are:

- [`tool.schema.json`](./tool.schema.json): package manifest contract.
- [`openapi.yaml`](./openapi.yaml): HTTP contract.

This document explains the lifecycle and the rules that are difficult to express in schemas.

## 1. Package contract

Upload one ZIP containing a self-contained browser application. `tool.json` must be at the ZIP
root. The current manifest is intentionally small:

```json
{
  "schemaVersion": 1,
  "code": "code-editor",
  "version": "1.0.0",
  "entry": "index.html"
}
```

`schemaVersion` versions the shape of `tool.json`. Runtime API compatibility is versioned only by
the URL (`/api/tool/v1`); there is deliberately no second `protocolVersion` field. `version` is the
tool author's semantic release version. Each upload is immutable and creates a new `ToolVersion`.
Existing work sessions stay pinned to the version that recorded them, even after another release
becomes active.

Archive requirements:

- paths are relative POSIX-style paths; traversal, absolute paths, drive letters, symlinks,
  encrypted entries, `.env`, `.git`, and `node_modules` are rejected;
- `entry` must identify an HTML file that exists in the archive;
- the manifest `code` must equal the permanent code of the Tool being updated;
- current safety limits are 25 MiB compressed, 100 MiB unpacked, 20 MiB per file, and 2,000 files.
  These are deployment limits, not protocol assumptions; a later storage policy may raise them.

Replay is **not** a second entry. The same application may expose a replay tab when the token
contains `replay:read`, and it reconstructs its UI from event batches returned by the API.

## 2. Trust boundary

A contributed package is untrusted code. Lernumi serves tools as full-page applications from a
dedicated origin, for example `https://tools.lernumi.com`, while the platform lives at
`https://app.lernumi.com`. Both hostnames may point to the same Next.js deployment; browser origin
isolation—not a separate server—is the security boundary.

The tool origin never receives the platform login cookie. Platform cookies must remain host-only
and must not use `Domain=.lernumi.com`. The runtime receives only a short-lived capability JWT and
can access only `/api/tool/v1/*`. Host routing rejects platform pages and unrelated APIs on the
tool origin. Runtime responses also apply CSP, `nosniff`, referrer, and browser feature policies.

Tools are opened by full-page navigation, so they can use module scripts, workers, downloads, and
the browser history normally. An iframe sandbox is only needed if a future UI embeds a tool inside
the platform page.

For local development, open the platform through `http://localhost:3000` and use
`TOOL_RUNTIME_ORIGIN=http://127.0.0.1:3000`. Both addresses reach the same Next.js process but are
different browser origins. Production should use sibling hosts such as `app.lernumi.com` and
`tools.lernumi.com`. The edge proxy must overwrite, rather than append or trust, incoming `Host`
and `X-Forwarded-Host` headers before forwarding requests to Next.js.

## 3. Launch and token lifecycle

The platform shell—not third-party code—starts a session through `POST /sessions` while the user is
logged in. A work launch supplies an owned assessment attempt, an allowed tool, and the exact role
assignment under which the user acts. A replay launch supplies the recorded work session and role
assignment. The server independently derives the workspace, institution, offering, tool version,
and capabilities; callers cannot widen scope by sending those IDs.

The response contains a five-minute HS256 JWT and a `runtimeUrl` on the isolated tool origin. The
token is encoded in the URL fragment because fragments are available to browser JavaScript but are
never sent in HTTP requests, server logs, or referrer headers. A trusted bootstrap page exchanges
it for a host-only runtime cookie before loading protected package assets. The tool entry receives
the same fragment and must consume and erase it immediately:

```ts
const launch = new URLSearchParams(location.hash.slice(1));
let token = launch.get('lernumi_token');
const apiVersion = launch.get('lernumi_api');
history.replaceState(null, '', location.pathname + location.search);

if (!token || apiVersion !== 'v1') {
  throw new Error('Lernumi launch credentials are missing');
}
```

Send it on every request:

```ts
async function api(path: string, init: RequestInit = {}) {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  const response = await fetch(`/api/tool/v1${path}`, {
    ...init,
    headers,
    credentials: 'include'
  });
  if (!response.ok) throw await response.json();
  return response;
}
```

Refresh shortly before expiry with `POST /token`, replace the in-memory token with the response,
and never persist it in local storage, IndexedDB, files, events, logs, or URLs. Refresh rechecks the
platform login session, role assignment, offering scope, permissions, assessment/tool association,
submission state, and pinned version. Revoked access therefore survives for at most one token TTL.
Once a token has expired, the normal platform launcher must create or reopen the session.

Because the launch token deliberately exists only in memory, a hard reload after the fragment has
been erased cannot restore it. Version 1 sends the user back through the Lernumi launcher instead
of persisting a bearer credential in browser storage shared by third-party tools.

Capabilities are intentionally coarse transport rights:

| Capability | Meaning |
|---|---|
| `files:read` | Read workspace metadata and content. |
| `files:write` | Create, upload, rename, move, overwrite, and delete workspace entries. |
| `events:append` | Append event batches and inspect the server checkpoint. |
| `replay:read` | List recorded sessions and download their opaque event batches. |

The JWT also binds every call to one user, role assignment, tool, immutable tool version, work
session, assignment workspace, mode, and read-only state. API clients never submit a workspace ID
to a document route.

## 4. Recommended startup

After reading and clearing the fragment:

1. Call `GET /context` and configure the UI from `session.mode`, `session.readOnly`, and
   `session.capabilities`.
2. Call `GET /documents?parentFolderId=root` to build the initial explorer.
3. In owner mode, call `GET /events/checkpoint`; resume local sequence numbering at `nextSeq`.
4. In replay mode, call `GET /replay/sessions` and request batches for a compatible session.
5. Refresh the JWT before `expiresIn` elapses.
6. On a clean owner shutdown, flush events and call `PATCH /session`. Treat close as idempotent.

## 5. Workspace documents

Folders and files are rows in one recursive tree. `parentFolderId: null` means root. Renaming a
folder changes one row; descendants retain their parent IDs and their displayed paths are rebuilt
from the tree. Sibling names are unique and the server rejects hierarchy cycles.

Content is separate from metadata:

- create an empty file or folder with JSON `POST /documents`;
- upload a file with multipart `POST /documents`;
- read bytes with `GET /documents/{id}/content`;
- replace bytes with `PUT /documents/{id}/content`.

Every content read returns the SHA-256 content hash as `ETag`. Every overwrite must return that
value in `If-Match`. A stale value returns `412 PRECONDITION_FAILED` with the current hash, allowing
the tool to reload or present a merge decision instead of silently losing edits. Current document
content is limited to 20 MiB.

Deleting a folder recursively deletes its descendants. This is an intentionally destructive API;
the tool should confirm the target and show the affected selection before calling it.

## 6. Event recording and recovery

The platform treats `events` as opaque JSON. Event names, payloads, editor operations, snapshots,
and replay rendering belong to the tool and should be versioned by the tool's own event schema.

Within one work session:

- sequence numbers are zero-based, inclusive, strictly contiguous, and monotonically increasing;
- `events.length` must equal `seqEnd - seqStart + 1`;
- one request contains at most 2,000 events and 1 MiB of JSON;
- `batchId` is a stable client-generated UUID used as an idempotency key;
- retry the **identical** batch after timeout or connection loss;
- a successful retry returns `duplicate: true` rather than inserting twice;
- reusing a `batchId` with different sequence, timestamp, or events returns
  `409 IDEMPOTENCY_CONFLICT`;
- `409 EVENT_SEQUENCE_CONFLICT` returns `details.expectedSeqStart`;
- `GET /events/checkpoint` is the authoritative recovery point.

Do not use wall-clock time to order replay. `clientAt` is diagnostic; the sequence range is the
ordering authority.

## 7. Replay

Replay data is available only when the launch token grants `replay:read`. Owners require
`tool_session.replay_own`; viewing another member also requires both `attempt.view_all` and
`tool_session.replay_all` in a role whose scope covers that offering.

The platform returns stored batches but does not interpret them. A replay must run under the exact
`ToolVersion` that recorded the target session. If a caller asks an incompatible runtime for a
session, the API returns `409 TOOL_VERSION_MISMATCH` and the required version ID. The platform
launcher should start replay from the selected work session so this mismatch does not normally
occur.

## 8. Errors, pagination, and caching

JSON failures have one stable envelope:

```json
{
  "error": {
    "code": "EVENT_SEQUENCE_CONFLICT",
    "message": "The event sequence does not continue from the server checkpoint",
    "details": { "expectedSeqStart": 42 }
  }
}
```

Clients should branch on `error.code`, not English text. Validation may add `fields`; conflict and
version errors may add `details`. API JSON is `Cache-Control: no-store`.

Document and replay-session collections use opaque UUID cursors. Follow `nextCursor` until it is
`null`. Replay events use the last inclusive sequence as `nextAfterSeq`; pass it back as
`afterSeq`. Never invent or increment a UUID cursor.

## 9. Implementation map

| Concern | Source |
|---|---|
| Request schemas and limits | `lib/tools/api-contract.ts` |
| JWT signing and verification | `lib/tools/token.ts` |
| Launch/replay authorization | `lib/tools/session-service.ts` |
| Runtime package validation | `lib/tools/package.ts` |
| Tool API routes | `app/api/tool/v1/**/route.ts` |
| Versioned runtime assets | `app/tools/[toolCode]/[toolVersionId]/[...assetPath]/route.ts` |
| Database history | `ToolVersion`, `AssignmentWorkSession`, `EventBatch` Prisma models |

The OpenAPI document is the endpoint-level source of truth. When changing a route, update its Zod
schema, tests, OpenAPI operation, and this lifecycle guide in the same commit.
