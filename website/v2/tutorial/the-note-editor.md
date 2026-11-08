---
description: "Open notes in a GtkSourceView editor with Markdown highlighting, inside a split view."
---

# Edit a Note

Open the selected note in a Markdown editor beside the list. The editor comes from GtkSourceView, a library outside the set GTKX generates bindings for by default, so the chapter starts by adding it.

## Add GtkSourceView

GTKX generates bindings for Adwaita, GTK and the libraries they depend on. Codegen reads each library's GIR file, which its development package installs. On Fedora, install GtkSourceView's; other distributions have an equivalent package:

```bash
sudo dnf install gtksourceview5-devel
```

List the library by GIR name and version in `gtkx.config.ts`, at the top of the object `defineConfig` receives:

```ts [gtkx.config.ts]
export default defineConfig({
    libraries: ["GtkSource-5"],
    applicationId: "dev.gtkx.Notes",
```

Then generate the bindings:

```bash
npm run codegen
```

This adds `@gtkx/gi/gtksource`, with GtkSourceView's classes and functions, and `@gtkx/jsx/gtksource`, with its elements. `gtkx dev` also regenerates the bindings whenever `gtkx.config.ts` changes. [The config file](/v2/guide/configuration-and-codegen#the-config-file) covers `libraries` and GIR files outside the standard search paths.

## Two screens in a split view

Install `@gtkx/navigation`, which renders [React Navigation](https://reactnavigation.org) navigators with Adwaita widgets, and `@react-navigation/core`, whose types the app extends:

```bash
npm install @gtkx/navigation@beta @react-navigation/core@^7
```

A split view navigator keeps its first screen in the sidebar and shows the others in the content pane. `src/navigation.ts` declares the screens:

<<< @/figures/tutorial/the-note-editor/src/navigation.ts [src/navigation.ts]

- `RootParamList` maps each screen to its route parameters: the `Notes` list takes none, and a `Note` takes the note's name.
- The `declare module` block registers the navigator as the app's root, which types `useNavigation()` and route parameters everywhere. TypeScript augments only a module it can resolve, which is why `@react-navigation/core` is installed directly; see [Typing the root param list](/v2/guide/navigation#typing-the-root-param-list).
- `useOpenNoteName` reads the navigation state with [`useNavigationState`](https://reactnavigation.org/docs/use-navigation-state/), which `@gtkx/navigation` re-exports. The last route is the open page: a `Note` route gives that note's name, and the sidebar's own route, when no note is open, gives `null`.

The window renders the navigator inside a `NavigationContainer`, within the notes provider so both screens read the same notes:

<<< @/figures/tutorial/the-note-editor/src/app.tsx{5,7,9,11,22-23,29-51} [src/app.tsx]

- `NavigationContainer` holds the navigation state; [NavigationContainer](/v2/guide/navigation#navigationcontainer) covers what else it accepts.
- `contentPlaceholder` fills the content pane until a note opens.
- Each screen's `title` names its header bar: Notes over the sidebar, and the note's name, read from the route, over the editor. The navigator gives the sidebar and the content pane their own header bars, so the toolbar view from Create a Window is gone.
- The window opens at 720 by 480, wide enough for both panes. [Adapt the Layout](/v2/tutorial/an-adaptive-layout) stacks them in narrow windows.

## Select the open note

The list now selects a row, and the selection follows the route:

<<< @/figures/tutorial/the-note-editor/src/components/notes-screen.tsx{7-8,35-37,40,52,65-71} [src/components/notes-screen.tsx]

- `selectedIds` holds the open note's name, so the highlighted row matches the content pane however the note was opened.
- `onSelectionChanged` reports the row the user picks, and `navigate` opens that note. Instead of keeping the selection in state, the handler changes the route, and the route selects the row. In a split view, `navigate` replaces the open note rather than stacking another page above it; see [Split view navigator](/v2/guide/navigation#split-view-navigator).
- The empty state's `compact` style class fits the status page into the narrow sidebar, as libadwaita's [`AdwStatusPage`](https://gnome.pages.gitlab.gnome.org/libadwaita/doc/1-latest/class.StatusPage.html) recommends.

## The editor

The editor shows a note's text in a [`GtkSourceView`](https://gnome.pages.gitlab.gnome.org/gtksourceview/gtksourceview5/class.View.html), a text view that highlights syntax:

<<< @/figures/tutorial/the-note-editor/src/editor/note-editor.tsx [src/editor/note-editor.tsx]

- The view's `buffer` prop takes a `GtkSourceBuffer` element, which holds the text, its language and its colors. Object properties accept elements, as [The JSX prop model](/v2/guide/jsx-elements#the-jsx-prop-model) describes.
- `getLanguage("markdown")` loads GtkSourceView's Markdown definition once, when the module loads. Importing `@gtkx/gi/gtksource` has already initialized the library; see [Library initialization](/v2/guide/configuration-and-codegen#library-initialization).
- GtkSourceView includes `Adwaita` and `Adwaita-dark` style schemes, which match the app's light and dark styles. `useProperty` follows the style manager's `dark` property and re-renders when it changes, so the buffer switches scheme with the system; see [Following a property](/v2/guide/native-state#following-a-property).
- `accessibleLabel` names the text view for screen readers. [Test the App](/v2/tutorial/testing) finds the editor by it.
- `wrapMode` wraps long lines at word boundaries, or between characters for a word longer than the line. The margins keep the text off the pane's edges.

The note screen looks up the note named in the route and opens it in the editor:

<<< @/figures/tutorial/the-note-editor/src/components/note-screen.tsx [src/components/note-screen.tsx]

`key={name}` gives each note its own editor: without it, opening another note would reuse the previous note's view, with its cursor and scroll position. A route that names a note the folder doesn't have shows a status page instead.

## Run it

Save the files. The config change regenerates the bindings and the new imports restart the app. The window opens with the list in the sidebar and No Note Selected beside it.

Click a note in the list. Its Markdown opens beside the list with syntax highlighting, in the dark scheme when the system prefers dark. Edits stay in the editor until [Save and Watch Files](/v2/tutorial/saving-and-watching) saves them.

<figure class="result">
    <img class="result-light" src="/figures/tutorial-the-note-editor-light.png" width="720" height="480" loading="lazy" alt="The Notes window split in two: the sidebar lists five notes with Website relaunch selected, and the content pane, titled Website relaunch, shows its Markdown with highlighted headings, bold text, a link and a numbered list." />
    <img class="result-dark" src="/figures/tutorial-the-note-editor-dark.png" width="720" height="480" loading="lazy" alt="The Notes window split in two: the sidebar lists five notes with Website relaunch selected, and the content pane, titled Website relaunch, shows its Markdown with highlighted headings, bold text, a link and a numbered list." />
    <figcaption>Captured from <a href="#two-screens-in-a-split-view"><code>src/app.tsx</code></a> above, after clicking Website relaunch.</figcaption>
</figure>
