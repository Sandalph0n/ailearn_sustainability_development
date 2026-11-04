# Team & Roles

Lernumi was built by a team of two between 21 August and 16 September 2026. This page
records what each member built. It is based on the repository's commit history.

| Member | Role |
| --- | --- |
| **Khôi Nguyên Vũ** | System architecture & design, data model, access control, tool platform, recording & replay, code-editor tool, administration, marking, deployment |
| **David Nguyen (Duy)** | Author of the EasyDraw diagram tool and its Lernumi integration, initial authentication, role context switcher, personal calendar, Macquarie Handbook adapter, site pages |

---

## Khôi Nguyên Vũ: System architecture, platform & core

### Architecture & design

- Designed the overall system architecture:
  - One Next.js application serves both front end and back end.
  - PostgreSQL with Prisma is the single data store.
  - Activity logs are stored as JSONB.
  - Every component follows AWS-compatibility rules: no local disk as the source of truth, no
    in-memory state between requests, and configuration only through environment variables.
- Defined the boundary between the platform and its tools. The platform owns storage, identity,
  permissions and context. A tool owns meaning: its editor, its event format and its replay.
  Tools are independent browser applications that talk to the platform through a published
  API, so a new tool can be added without changing the platform.
- Specified the shared activity-log (op-log) format that every tool records into.
- Wrote the design documents:
  - [docs/architecture.md](./docs/architecture.md)
  - [docs/project-plan.md](./docs/project-plan.md), covering scope, the op-log specification, the
    schedule and the task split
  - The conceptual data model diagram (`prisma/schema/conceptual-model.drawio`)
  - The [Tool Platform Contract](./docs/tool-platform/README.md), with the
    [OpenAPI v1 spec](./docs/tool-platform/openapi.yaml) and the
    [`tool.json` schema](./docs/tool-platform/tool.schema.json)

### Data model

- Designed the conceptual model and the Prisma schema. The schema is split into four domains
  (auth, institution, learning, activity), with one file per model and a migration history
  starting from v1.
- Main hierarchy: institution → subject → offering → assessment → attempt → marking.
  - Work sessions and event batches store recorded activity.
  - Assessment attempts are repeatable.
- Access model:
  - Roles form a directed acyclic graph (DAG), and permissions are inherited through it.
  - Roles are scoped to offerings through a many-to-many relation.
  - Every scope assignment is auditable and records its provenance, such as a direct grant or
    an approved request.
- Tool versions are immutable. Each work session is pinned to the exact tool version that
  produced it, so a replay always runs the same software that recorded it.
- Storage object keys are kept on users and institutions for avatars and logos.

### Access control (RBAC)

- Role DAG with inherited permissions, granular CRUD permissions, and permission resolution
  based on the active context.
- Scoped institution workspaces. Navigation is generated from the active permissions, and
  read-only roles are handled.
- Role switching with confirmation. Roles can be granted with or without an offering scope.
- Join requests and subject access requests, with an admin review workflow.

### Administration

- Shared CRUD scaffolding with search, sort and paging stored in the URL, data tables and page
  editors.
- Global and institution-level management of:
  - users
  - institutions
  - tools
  - subjects
  - study terms and term periods
  - roles
  - offerings
  - assessments
  - role assignments
- Institution settings workspace (terms, offerings, roles, people, requests), a transfer-list
  role selector, searchable role grant controls and stricter validation.

### Tool platform & runtime

- Tool packages are uploaded as ZIP files. Each upload is versioned and cannot be changed
  afterwards. The `tool.json` manifest is validated and every package gets a SHA-256 hash.
- Implemented the runtime API (`/api/tool/v1`):
  - launch tokens
  - version pinning
  - the workspace document API
  - storage of recorded event batches
  - session handling that survives connection problems
- Each tool runs on its own origin, isolated from the platform. Tool service workers are served
  without auth redirects.

### Code-editor tool

- Built a modular, VS Code-based learning tool (`packages/code-editor-tool`) with a workbench,
  editor themes, a custom title bar and activity recording.
- Added a replay inspector and a replay history explorer.

### Recording & replay

- Built the shared replay package, `packages/replay-core`.
- Added recording and replay to the EasyDraw tool, including how diagram connections are drawn
  during replay.

### Workspace

- Full-screen workbench with a file explorer. Documents are stored as a recursive tree.
- Folder navigation history, multi-select, and an "open with" menu listing the tools available
  for the assessment.

### Marking

- Marking and replay workspace for tutors, with attempts grouped by student and a staged
  selection screen.
- Attempt flags, a mark schema, route guards for attempts, and the tutor review flow.

### Storage

- Storage layer over S3-compatible object storage (MinIO in development). It uses four buckets,
  each with its own policy:
  - `media` for avatars and logos
  - `docs` for workspace documents
  - `tools` for tool packages
  - `archive` for sealed work sessions, with Object Lock enabled
- Profile pictures and institution logos.

### User interface

- shadcn/ui theme, app shell, home page, dashboard, notifications sidebar and profile page.
- Authentication integration: adapted the initial authentication module to the final schema
  and connected it to the sign-in and sign-up UI.

### Development environment, data, testing & deployment

- Docker Compose setup with Postgres and MinIO, a one-step `pnpm app:init`, and Windows
  development support.
- Macquarie curriculum seed pipeline:
  1. Fetch the public Handbook and Unit Guides.
  2. Normalise them into CSV files.
  3. Validate the CSV files and generate SQL from them.
- Seed data for roles and assessments, and a portable database snapshot workflow.
- Unit tests (tool contract, packages, tokens, workspaces, marking, role catalog, seeding), a
  Playwright screenshot script and browser test personas for each role.
- Deployment to AWS App Runner and Vercel (Sydney region), with Prisma client generation and
  database migrations run during the build.

---

## David Nguyen (Duy): Diagram tool, authentication, calendar & site pages

### EasyDraw diagram tool

- Author of [EasyDraw](https://github.com/davidnguyen16/easydraw), his own diagram editor for
  ERD, UML, flowcharts and DFDs. He developed it independently and brought it into Lernumi as
  its diagram tool.
- Packaged EasyDraw as a Lernumi tool (`packages/easydraw-tool`):
  - The host application handles launch tokens and provides the dashboard and editor screen.
  - A documents adapter saves each diagram as `<title>.easydraw` in the attempt workspace, with
    ETag/If-Match writes.
  - Submitted attempts open read-only.
  - Shims let the upstream editor run unchanged.
  - Build and packaging scripts.
- Recording and replay inside EasyDraw were added later by Khôi Nguyên Vũ (see above).

### Authentication (initial implementation)

- Email and password authentication on the server:
  - register, login, logout, logout-all and session APIs
  - Argon2id password hashing
  - database sessions with SHA-256-hashed tokens, and cookie configuration
  - same-origin request checks and Zod validation
  - unit tests and an auth test page
- Automatic role grants based on the email address at registration, including roles scoped to
  an offering.

### Role context switcher

- The active institution, role and offering are kept in the URL, so a view can be shared and
  bookmarked. The server checks that context against the user's current role assignments
  before using it.
- The context switcher sits in the application header.

### Personal calendar

- Week view:
  - assessment due dates shown as chips
  - personal events that can be created, moved and resized by dragging
- Term Gantt chart:
  - teaching, recess and exam bands
  - planned start and finish bars for each assessment
  - a weekly row summing assessment due weight
- `CalendarEvent` and `AssessmentPlan` models, their API routes, and seed data for the
  Macquarie 2026 term periods.

### Macquarie Handbook adapter

- An institution adapter (`lib/institution-adapters`) that looks up subject details from the
  public Macquarie Handbook.
- Lookup APIs and a "Fill from Macquarie Handbook" button on the subject form.

### Subject access requests

- Term filter and word-by-word search for subject access requests.

### Site pages & branding

- About, Privacy Policy and Terms of Service pages, the site footer, the brand logo, and a
  light, dark and system theme menu.
- Lernumi branding for the navigation and sign-in page.

### Data

- Seed data for three essay-based Macquarie Law units.
