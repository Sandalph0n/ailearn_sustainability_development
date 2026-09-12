# Building a VS Code-style browser workbench with CodinGame

This guide is a reusable reference for projects that embed the VS Code workbench through
`@codingame/monaco-vscode-api`. It focuses on UI composition, views, split/grid layout,
persistence, editor groups, and the relationship between an editor and its model.

The examples target CodinGame packages `36.2.7`. The public `vscode` API is comparatively stable;
imports under `vscode/vs/...` are VS Code internals and must be rechecked when upgrading all
CodinGame packages in lockstep.

## 1. Choose the right level of abstraction

There are three distinct layers. Do not mix their responsibilities.

1. **Workbench layout** owns the real VS Code shell: title bar, activity bar, sidebar, panel,
   status bar, editor area, view containers, and editor groups.
2. **`SplitView` / `Grid`** are lower-level DOM layout widgets for custom surfaces inside a view or
   editor. They do not create VS Code editor groups or persist workbench state automatically.
3. **Monaco models and VS Code editors** own document state. A split pane is only geometry; a model
   is the content; an editor group decides where an editor input is shown.

Use the workbench whenever the product should behave like VS Code. Use `SplitView` or `Grid` inside
a custom pane only when the workbench's standard parts are not enough.

## 2. Initialize one workbench

Create one full-size host element and initialize the service graph exactly once.

```html
<div id="workbench"></div>
```

```css
html, body, #workbench {
  width: 100%;
  height: 100%;
  margin: 0;
  overflow: hidden;
}
```

```ts
import { initialize, type IEditorOverrideServices } from '@codingame/monaco-vscode-api';
import getModelServiceOverride from '@codingame/monaco-vscode-model-service-override';
import getWorkbenchServiceOverride from '@codingame/monaco-vscode-workbench-service-override';

const services: IEditorOverrideServices = {
  ...getModelServiceOverride(),
  // Add the file, storage, theme, language, keybinding, workbench, and other overrides required
  // by the features you actually expose.
  ...getWorkbenchServiceOverride(),
};

await initialize(services, document.querySelector('#workbench')!, options);
```

Register file systems, built-in extensions, custom views, editor panes, serializers, workers, and
initial configuration before `initialize`. Call APIs that require live services only after the
promise resolves.

## 3. Describe the initial workbench layout

`IWorkbenchConstructionOptions.defaultLayout` is the declarative entry point. It can reveal views,
open resources, and create the initial editor-group tree.

```ts
import {
  GroupOrientation,
  type IWorkbenchConstructionOptions,
} from '@codingame/monaco-vscode-api';
import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';

const options: IWorkbenchConstructionOptions = {
  workspaceProvider: {
    trusted: true,
    workspace: { folderUri: URI.parse('project://workspace/') },
    async open() { return false; },
  },
  defaultLayout: {
    views: [
      { id: 'workbench.explorer.fileView' },
      { id: 'my.product.timeline' },
    ],
    layout: {
      editors: {
        orientation: GroupOrientation.HORIZONTAL,
        groups: [
          { size: 0.65 },
          {
            size: 0.35,
            groups: [{ size: 0.5 }, { size: 0.5 }],
          },
        ],
      },
    },
    editors: [
      { uri: URI.parse('project://workspace/src/main.ts'), viewColumn: 1 },
      { uri: URI.parse('project://workspace/README.md'), viewColumn: 2 },
    ],
    force: false,
  },
};
```

`viewColumn` is one-based and follows visual order from top-left to bottom-right. `size` values among
siblings should add up to `1`. Nested `groups` alternate orientation relative to their parent.

Keep `force: false` in normal products: `defaultLayout` then applies only to a workspace without
restorable state. `force: true` is useful for demos and deterministic tests, but destroys the
user's saved arrangement on every startup.

## 4. Add a view to the sidebar or panel

For a direct in-process contribution, `registerCustomView` is the smallest useful API.

```ts
import {
  registerCustomView,
  ViewContainerLocation,
} from '@codingame/monaco-vscode-api/service-override/tools/views';

const registration = registerCustomView({
  id: 'my.product.timeline',
  name: 'Timeline',
  location: ViewContainerLocation.Sidebar,
  order: 20,
  default: true,
  icon: new URL('./timeline.svg', import.meta.url).toString(),
  renderBody(container) {
    const root = document.createElement('div');
    root.className = 'timeline-view';
    container.append(root);

    const unsubscribe = domainModel.onDidChange(() => render(root));
    render(root);

    return {
      dispose() {
        unsubscribe.dispose();
        root.remove();
      },
    };
  },
});
```

The returned disposable is ownership: dispose listeners, timers, nested widgets, and DOM created by
the view. For a reusable or third-party feature, prefer a real VS Code extension contribution;
`registerCustomView` is most appropriate when the host application owns the code.

## 5. Build a one-dimensional resizable surface with `SplitView`

Each child implements `IView`: one DOM element, min/max constraints, a constraint-change event, and
a `layout` method.

```ts
import { Event } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';
import {
  Orientation,
  SplitView,
  Sizing,
  type IView,
} from '@codingame/monaco-vscode-api/vscode/vs/base/browser/ui/splitview/splitview';

class Pane implements IView {
  readonly element = document.createElement('section');
  readonly minimumSize = 160;
  readonly maximumSize = Number.POSITIVE_INFINITY;
  readonly onDidChange = Event.None;

  constructor(readonly id: string) {
    this.element.dataset.pane = id;
  }

  layout(size: number): void {
    // Vertical orientation reports height; horizontal orientation reports width.
    this.element.style.setProperty('--pane-size', `${size}px`);
  }
}

const split = new SplitView(host, { orientation: Orientation.HORIZONTAL });
const explorer = new Pane('explorer');
const editor = new Pane('editor');

split.addView(explorer, 280);
split.addView(editor, Sizing.Distribute);
split.layout(host.clientWidth);

const observer = new ResizeObserver(() => split.layout(host.clientWidth));
observer.observe(host);
```

The operational API includes `addView`, `removeView`, `removeAllViews`, `moveView`, `swapViews`,
`resizeView`, visibility controls, and size distribution. The owner must call `layout` after the
host changes size and dispose both observer and split view when the surface closes.

For persistence, store your own ordered pane IDs, visibility flags, and sizes. Recreate pane
objects first, then pass them through the constructor's `descriptor`. `SplitView` does not know how
to serialize application-specific view identity.

## 6. Build nested panes with `Grid` or `SerializableGrid`

`Grid` is the friendly object-addressed API. `GridView` is the lower-level index-path API. Prefer
`Grid` unless you have a measured reason to manipulate locations such as `[1, 0, 1]` directly.

```ts
import {
  Direction,
  Orientation,
  SerializableGrid,
  Sizing,
  type ISerializableView,
} from '@codingame/monaco-vscode-api/vscode/vs/base/browser/ui/grid/grid';
import { Event } from '@codingame/monaco-vscode-api/vscode/vs/base/common/event';

class GridPane implements ISerializableView {
  readonly element = document.createElement('section');
  readonly minimumWidth = 160;
  readonly maximumWidth = Number.POSITIVE_INFINITY;
  readonly minimumHeight = 100;
  readonly maximumHeight = Number.POSITIVE_INFINITY;
  readonly onDidChange = Event.None;

  constructor(readonly id: string) {}
  layout(width: number, height: number): void {
    this.element.style.width = `${width}px`;
    this.element.style.height = `${height}px`;
  }
  toJSON(): object { return { id: this.id }; }
}

const editor = new GridPane('editor');
const grid = new SerializableGrid(editor);
const explorer = new GridPane('explorer');
const output = new GridPane('output');

grid.addView(explorer, 280, editor, Direction.Left);
grid.addView(output, Sizing.Split, editor, Direction.Down);
host.append(grid.element);
grid.layout(host.clientWidth, host.clientHeight);
```

Mutation methods cover add, remove, move, swap, resize, show/hide, expand, maximize, and equal size
distribution. Persist and restore the whole geometry as JSON:

```ts
const json = grid.serialize();
localStorage.setItem('workbench-grid-v1', JSON.stringify(json));

const restored = SerializableGrid.deserialize(
  JSON.parse(localStorage.getItem('workbench-grid-v1')!),
  { fromJSON: ({ id }) => new GridPane(id) },
);
host.replaceChildren(restored.element);
restored.layout(host.clientWidth, host.clientHeight);
```

Version your stored envelope and validate it before deserializing. A safe production shape is
`{ schemaVersion, packageVersion, layout }`. If a pane ID is unknown or a migration fails, discard
the saved layout and use a known default instead of leaving the UI half-restored.

## 7. Let the workbench persist its own layout

The workbench already serializes parts, editor groups, open editors, view visibility, and many
sizes through `IStorageService`. Persistence therefore depends on the storage override supplied to
`initialize`.

- An in-memory `IStorageDatabase` deliberately resets layout on reload.
- An IndexedDB-backed database restores layout for the same workspace/profile.
- A remote database adapter can synchronize layout, but should namespace records by product,
  account, profile, and workspace.

Do not separately serialize the editor-group grid when the standard workbench owns it. Store custom
`SerializableGrid` state only for grids your own view/editor created. Avoid two sources of truth.

## 8. CRUD editor groups

After initialization, obtain the service and wait until its model is ready.

```ts
import {
  getService,
  GroupDirection,
  GroupsArrangement,
  GroupsOrder,
  IEditorGroupsService,
} from '@codingame/monaco-vscode-api';

const groups = await getService(IEditorGroupsService);
await groups.whenReady;

const first = groups.activeGroup;
const right = groups.addGroup(first, GroupDirection.RIGHT);
groups.activateGroup(right);

groups.moveGroup(right, first, GroupDirection.DOWN);
groups.arrangeGroups(GroupsArrangement.EVEN);

const visualOrder = groups.getGroups(GroupsOrder.GRID_APPEARANCE);
const savedLayout = groups.getLayout();

// Remove only after deciding what should happen to dirty/open editors.
groups.removeGroup(right);
```

Useful operations are:

- create: `addGroup(reference, direction)` or `copyGroup`;
- read: `groups`, `count`, `activeGroup`, `getGroup`, `findGroup`, `getLayout`, `getSize`;
- update: `activateGroup`, `moveGroup`, `setSize`, `applyLayout`, `arrangeGroups`;
- delete/merge: `removeGroup`, `mergeGroup`, `mergeAllGroups`.

Group IDs survive moves, so keep the ID—not the visual index—as application state. Visual indices
change when the user rearranges the grid. Await `whenRestored` if subsequent code depends on active
editors having finished resolving, not merely on the group tree existing.

## 9. Open a resource in a specific group

For normal resources, use the editor service with an untyped resource input.

```ts
import {
  getService,
  IEditorService,
  IEditorGroupsService,
} from '@codingame/monaco-vscode-api';
import { URI } from '@codingame/monaco-vscode-api/vscode/vs/base/common/uri';

const editorService = await getService(IEditorService);
const groupService = await getService(IEditorGroupsService);
await groupService.whenReady;

const resource = URI.parse('project://workspace/src/main.ts');
const target = groupService.activeGroup;

await editorService.openEditor(
  {
    resource,
    options: { pinned: true, preserveFocus: false },
  },
  target,
);
```

`SIDE_GROUP` is convenient when the exact group is not important. When group identity matters,
pass an `IEditorGroup` or its stable ID. At the group level, `moveEditor`, `copyEditor`,
`closeEditor`, `closeAllEditors`, pin/sticky operations, and selection APIs implement editor CRUD
without rebuilding the layout.

The public extension API is simpler when extension semantics are enough:

```ts
import * as vscode from 'vscode';
import 'vscode/localExtensionHost';

const document = await vscode.workspace.openTextDocument(resource);
await vscode.window.showTextDocument(document, {
  viewColumn: vscode.ViewColumn.Beside,
  preview: false,
  preserveFocus: false,
});
```

## 10. Bind editors to models and files

The URI is the identity joining the filesystem, model, language services, dirty state, editor
input, and save operation.

For a VS Code workbench, register a filesystem provider for the URI scheme, then open the resource.
The text-file/model services read through that provider and build the editor model lazily. This is
the preferred path for a real file explorer and cross-file language features.

For a standalone Monaco editor that still participates in VS Code services, use
`createModelReference` instead of `monaco.editor.createModel`:

```ts
import * as monaco from 'monaco-editor';

const resource = monaco.Uri.parse('project://workspace/src/main.ts');
const reference = await monaco.editor.createModelReference(resource);
const editor = monaco.editor.create(container, {
  model: reference.object.textEditorModel,
});

await reference.object.save();

editor.dispose();
reference.dispose();
```

The resource must exist in a registered filesystem, or content must be supplied to
`createModelReference(resource, initialContent)`. Dispose the reference only after all consumers
are done; the underlying model is reference-counted.

Avoid `monaco.editor.createModel` for files that the workbench should open. That standalone model is
not automatically discoverable by VS Code services and commonly leads to duplicate models, broken
save state, and missing cross-file navigation.

## 11. Custom editor panes

When a resource should render something other than the standard text editor:

1. subclass `SimpleEditorInput` or a suitable resource input;
2. subclass `SimpleEditorPane` and implement `initialize` plus `renderInput`;
3. register the pane with `registerEditorPane`;
4. register resource resolution with `registerEditor` when callers should open it by URI;
5. register an `IEditorSerializer` when the editor must survive reload.

The serializer contract is deliberately small:

```ts
interface IEditorSerializer {
  canSerialize(editor: EditorInput): boolean;
  serialize(editor: EditorInput): string | undefined;
  deserialize(instantiationService: IInstantiationService, value: string): EditorInput | undefined;
}
```

Serialize identifiers and reconstructible state, not DOM, services, or a full model snapshot. The
filesystem/database remains the source of document content; serialized editor state only says how
to reopen the view.

## 12. Lifecycle checklist

- Register contributions and providers before `initialize`.
- Initialize the service graph once per page.
- Give every resource a stable URI and one authoritative filesystem provider.
- Use workbench groups for editor layout; use Split/Grid only inside custom surfaces.
- Use `ResizeObserver` and call `layout` with actual dimensions.
- Persist either workbench storage or your custom grid, never competing copies of the same layout.
- Version and validate serialized state.
- Dispose registrations, model references, editors, event listeners, workers, and layout widgets.
- Test create/open/edit/save, split/move/merge/close, reload restoration, keyboard navigation, and
  narrow/wide viewport layouts after every CodinGame upgrade.
