---
description: "Test Notes headless with real files in a temporary folder."
---

# Test the App

Test the app's workflows the way a user runs them: open a note, type, use the menus, and check what lands in the notes folder. The tests render the whole app in a headless session, find widgets through the accessibility tree, and work on real files in a temporary folder, without mocks.

The project already has the testing setup you chose when [scaffolding it](/v2/tutorial/#check-your-setup): Vitest, `@gtkx/testing`, the `test` script and `vitest.config.ts`. [Testing](/v2/guide/testing) covers the tools in full.

## A temporary notes folder

Replace `vitest.config.ts`:

<<< @/figures/tutorial/testing/vitest.config.ts [vitest.config.ts]

- `setupFiles` runs `tests/setup.ts` in each test file's worker before the file's tests.
- `env` runs the tests in the C locale with English messages, so the names they look for stay the same whatever the language of the machine.

Create `tests/setup.ts`:

<<< @/figures/tutorial/testing/tests/setup.ts [tests/setup.ts]

- `XDG_DATA_HOME` points into a temporary directory, so a note moved to the trash goes to a trash there instead of yours. GLib reads the variable once, when the test file imports GTKX, so the setup file sets it at the top level rather than in `beforeEach`. See [Test data and settings](/v2/guide/testing#test-data-and-settings).
- Before each test, `beforeEach` copies the fixtures into a new notes folder and gives them fixed modification times, so the list's newest-first order is known.
- Tests use GLib's in-memory settings backend and never touch your settings. A value one test writes would stay for the next test in the file, so `beforeEach` resets every key in the schema and then points `folder` at the new notes folder.

The fixtures are two notes. Create `tests/fixtures/Groceries.md`:

<<< @/figures/tutorial/testing/tests/fixtures/Groceries.md [tests/fixtures/Groceries.md]

And `tests/fixtures/Reading list.md`:

<<< @/figures/tutorial/testing/tests/fixtures/Reading list.md [tests/fixtures/Reading list.md]

## Find widgets by role and name

Create `tests/notes.test.tsx` with the suite below. It covers each feature from the earlier chapters, one test per workflow; the rest of this chapter explains how its tests work.

::: details The complete `tests/notes.test.tsx`

<<< @/figures/tutorial/testing/tests/notes.test.tsx [tests/notes.test.tsx]

:::

The first test checks the order of the list:

```tsx
const noteRows = (): Promise<Gtk.Widget[]> =>
    screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);

describe("Notes", () => {
    it("lists the Markdown files in the folder, newest first", async () => {
        await render(<App />, { container: rootElement });

        const [first, second] = await noteRows();
        expect(first).toHaveAccessibleName("Reading list");
        expect(second).toHaveAccessibleName("Groceries");
    });
```

- `render` with `container: rootElement` renders `App` as `src/index.tsx` does, with its application element and window, instead of inside a test window. See [Rendering a component](/v2/guide/testing#rendering-a-component).
- `screen` searches every open window, including dialogs and popovers. Queries take a `Gtk.AccessibleRole` and an accessible name: the names that earlier chapters gave the rows (the note's name), the editor (Note text) and the search entry (Search Notes). An icon button has no label, so its tooltip names it, as in `{ name: "Note Menu" }`. See [Finding widgets](/v2/guide/testing#finding-widgets).
- `findBy` and `findAllBy` queries wait for the widget to appear, here for the notes to load. `getBy` queries expect the widget to be there already, and `queryBy` queries return `null` when it isn't, to check that something is gone.
- `toHaveAccessibleName`, `toBeVisible` and the other widget matchers are available once the file imports `@gtkx/testing`. See [Assertions and debugging](/v2/guide/testing#assertions-and-debugging).

The `as` option in `openNote` keeps only a `Gtk.TextView` and types the result as one, so `editorText` can read its buffer.

## Check the notes folder

The tests read the notes folder to check what the app wrote, and write to it to act as another program would:

```tsx
it("saves what is typed to the note's file", async () => {
    await render(<App />, { container: rootElement });

    const editor = await openNote("Groceries");
    await userEvent.type(editor, "- Rice\n");

    await waitFor(() => {
        expect(
            readFileSync(join(notesFolder(), "Groceries.md"), "utf8"),
        ).toContain("- Rice");
    });
});
```

- `userEvent` helpers act as a user does and wait until React has applied the result. Await each one. See [Interacting and waiting](/v2/guide/testing#interacting-and-waiting).
- The app saves 400 milliseconds after the last edit, so `waitFor` retries the assertion until the file has the new text, for up to a second.
- "shows notes added and removed outside the app" and "reloads an open note changed outside the app" write and delete files with `node:fs` and wait for the list and the editor to follow, which tests the file watching from [Save and Watch Files](/v2/tutorial/saving-and-watching).
- "moves a note to the trash and undoes it" finds the moved file under `Trash/files` in the temporary `XDG_DATA_HOME`.
- "says when a note can't be saved" makes the file read-only with `chmodSync` and waits for the error toast.

## Change settings

A test that needs a setting other than its default writes it with `Gio.Settings` before rendering, as "opens the note a preview link points to" does to open notes in the preview.

A setting written while the app is open updates React state outside the `userEvent` helpers, so "switches to another folder with the window and Preferences open" writes the new folder inside `act`:

```tsx
await act(() => {
    Gio.Settings.new(schema.id).setString("folder", otherFolder);
});
```

`act` applies the updates before the test continues; without it, React warns that an update was not wrapped in `act(...)`. The test then checks that the window it started with now lists the other folder, and that Preferences stayed open.

## Type into the editor

"completes a link to another note after [[" tests the completion provider from [Complete Note Links](/v2/tutorial/note-links). `userEvent.type(editor, "[[read")` inserts one character per edit, as typing does, so GtkSourceView sees the second `[` and opens its popup. `read` narrows the popup to Reading list. The popup belongs to the editor, so `within(editor)` finds the proposal there and not the Reading list row in the sidebar. Clicking it inserts the link, which the test then finds in the editor and in the file.

## Test the stories

The preview's tests render the stories from [Develop the Preview in Storybook](/v2/tutorial/storybook) instead of repeating their Markdown. Create `tests/preview.test.tsx`:

<<< @/figures/tutorial/testing/tests/preview.test.tsx [tests/preview.test.tsx]

- `composeStories` turns each story into a component with the story's arguments applied. See [Reuse stories in native tests](/v2/guide/storybook#reuse-stories-in-native-tests).
- A story takes props that override its arguments, so the link test passes its own `onActivateLink` and collects the targets it receives.
- These components have no window of their own, so `render` puts them in a test window.

## Run the tests

The tests run in a private headless display and session bus, which need Sway and `dbus-daemon`. Install them as [Setup](/v2/guide/testing#setup) shows, then run:

```bash
npm test
```

Each test starts from the fixtures and the default settings, so any test also runs on its own. To run only the tests whose names contain "trash":

```bash
npx vitest run -t trash
```

## Run it

`npm test` passes both files:

```txt
 ✓ tests/preview.test.tsx (3 tests)
 ✓ tests/notes.test.tsx (22 tests)

 Test Files  2 passed (2)
      Tests  25 passed (25)
```

Change `openNote("Groceries")` in "opens a note in the editor" to `openNote("Shopping")` and run the tests again. The query fails after a second and lists each accessible role on screen with the names of its widgets, such as the list items Reading list and Groceries. Change it back afterwards.
