# EasyDraw tool

The [EasyDraw](https://github.com/davidnguyen16/easydraw) diagram editor (ERD, UML,
flowcharts, DFD) packaged as a Lernumi tool. Students launch it from an assessment
attempt and land straight on the dashboard; diagrams are saved as `<title>.easydraw`
files in the attempt workspace through `/api/tool/v1/documents`.

## Layout

| Folder | What it is |
| --- | --- |
| `editor/` | The upstream editor, copied verbatim from easydraw `client/src` (`lib/**` plus `app/globals.css` and `app/xy-theme.css`). It keeps importing `@/lib/...`; `@` is aliased to this folder. See *Syncing* before editing here. |
| `src/` | The Lernumi host: launch/token handling (`App.tsx`), dashboard, editor screen, the documents adapter (`diagrams.ts`), and shims for `next/link` / `next/navigation`. |
| `public/` | `tool.json` and the editor fonts. Vite copies these to the package root. |

Only two upstream files know about the host: `editor/lib/backend.ts` (swappable
save backend — the host points it at the workspace API) and the `next/*` imports in
`editor/lib/components/MenuBar.tsx` and `editor/lib/flow/use-diagram-id.ts`, which
resolve to `src/shims/`.

## Build and upload

```sh
pnpm tool:easydraw:package   # repo root → packages/easydraw-tool/artifacts/easydraw-<version>.zip
```

Every upload is immutable, so bump `version` in `public/tool.json` before packaging a
change. Then in Lernumi: **Admin → Tools → EasyDraw → New version** (or **New tool**
with code `easydraw` on a fresh database), upload the zip, keep *activate* on, and
attach the tool to assessments under **Offerings → assessment → Rules and tools**.

## Syncing from upstream easydraw

`editor/` mirrors `client/src/lib` of the `Easydraw-Lernumi` repository at the commit
noted in `editor/UPSTREAM`. To pull newer editor changes: copy `client/src/lib/**`
(minus the landing/legal/auth-only components), `client/src/app/globals.css` and
`client/src/app/xy-theme.css` over `editor/`, keep `editor/lib/backend.ts`, rebuild,
and update `editor/UPSTREAM`.

## Runtime notes

- Assets are served from `/tools/easydraw/<versionId>/…`, so every URL in the bundle
  is relative (`base: './'`); fonts end up as `../fonts/*.woff2` in the CSS.
- CSP is `connect-src 'self'`: the tool can only reach `/api/tool/v1/*`.
- `src/styles.css` adds `@source '../editor'` so Tailwind keeps utilities used only
  inside the editor.
- The launch token lives in memory. On a hard reload the tool recovers a fresh token
  through the host-only `POST __lernumi/token` bridge; normal refresh still runs every
  ~4 minutes through `POST /token`.
- Owner sessions record ordered, integrity-chained workspace events. **History** replays
  one session or the complete attempt history inside the same EasyDraw entry; reviewers
  enter this read-only replay surface directly when Lernumi grants `replay:read`.
- A submitted attempt launches with `session.readOnly`: the canvas is locked and the
  dashboard hides create/rename/duplicate/delete. The token then lacks `files:write`,
  so nothing can be written server-side either way.
