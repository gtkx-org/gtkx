---
description: "Persist the store to the XDG data directory so tasks survive a restart."
---

# Saving Tasks Between Runs

[The last chapter](/v2/tutorial/completing-and-deleting) wired each row to store actions. Those actions change state in memory, so everything is lost when you quit. This page fixes that, and you won't write a save call yourself.

## Where user data goes

GNOME applications keep user content in a file under the XDG data directory. Preferences, the settings that describe how the app is configured, go in GSettings instead, covered in [Preferences and the System Theme](/v2/tutorial/preferences-and-theming).

Tasks get a file you own, written atomically, in a standard desktop location.

## A storage backend

zustand's `persist` middleware needs somewhere to put its bytes. You give it an object with `getItem`, `setItem`, and `removeItem`.

Create `src/store/storage.ts`:

```ts
import { mkdirSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";

const directory = join(process.env.XDG_DATA_HOME ?? join(homedir(), ".local", "share"), "com.gtkx.tutorial");
const file = join(directory, "tasks.json");

export const fileStorage = {
    getItem: (_name: string): string | null => {
        try {
            return readFileSync(file, "utf8");
        } catch {
            return null;
        }
    },
    setItem: (_name: string, value: string): void => {
        mkdirSync(directory, { recursive: true });
        writeFileSync(`${file}.tmp`, value);
        renameSync(`${file}.tmp`, file);
    },
    removeItem: (_name: string): void => rmSync(file, { force: true }),
};
```

This uses the Node standard library only. A GTKX app is a Node.js process that drives the GNOME application platform through libadwaita and GTK4, so reach for Node wherever it covers the job and save GLib and Gio for what is unique to the platform: settings, notifications, D-Bus, and the widget toolkit itself.

**The path.** `$XDG_DATA_HOME` names the per-user data directory, falling back to `~/.local/share` when unset, namespaced with the application ID you chose when scaffolding.

**`getItem` swallows the read error.** On a first launch there is no file, which is not a failure. `persist` expects `null` when nothing is saved yet.

**`setItem` writes to a sibling and renames.** An interrupted `writeFileSync` on the real path leaves a truncated JSON file that won't parse. `renameSync` within one directory is atomic on Linux, so `tasks.json` is either the whole previous version or the whole new one.

## Turning it on

Wrap the store creator from [Adding Tasks with a Store](/v2/tutorial/the-task-store) in `persist`. Nothing inside it changes.

The import line in `src/store/index.ts`:

```diff
 import { create } from "zustand";
+import { createJSONStorage, persist } from "zustand/middleware";
```

Then `src/store/index.ts`, with the action bodies left alone:

```ts
// ...

export type PersistedState = { tasks: Task[] };

export const useStore = create<Store>()(
    persist(
        (set) => ({
            tasks: seedTasks,
            // ...
        }),
        {
            name: "tasks",
            version: 1,
            storage: createJSONStorage(() => fileStorage),
            partialize: (state): PersistedState => ({ tasks: state.tasks }),
        },
    ),
);
```

`persist` takes a creator and returns a creator, so `create` never learns anything changed. `name` is the key inside the saved document. `createJSONStorage` sits between `persist` and your backend, stringifying state on the way out and parsing it on the way in, so `fileStorage` only ever deals in strings.

`partialize` picks what gets saved. It names `tasks` and nothing else, because the store also holds actions, and an action is a function that JSON cannot represent. Saving the whole state would write `{}` where each action was, and read it back as a store whose buttons do nothing.

Typing `partialize` as returning `PersistedState` makes that type the single description of what is on disk, so anything you add to it is added deliberately.

## What you did not have to write

`persist` subscribes to the store and writes on every committed `set`. There is no save effect watching the tasks, no debounce timer (ticking a checkbox writes a few kilobytes to a local file, faster than scheduling the write would be), and nothing for the window's close handler to flush.

Hydration is the other half. Your backend is synchronous, so `persist` reads the file while the store is being created, before React renders anything. The first frame shows what was on disk.

## Surviving a change to the shape

`version: 1` tags the saved document with a version number. When you later change the shape of a task, the file on a user's machine is still the old shape. `migrate` is where you handle that.

Add it to `src/store/index.ts`:

```diff
+const isPersistedState = (value: unknown): value is PersistedState =>
+    typeof value === "object" && value !== null && Array.isArray(Reflect.get(value, "tasks"));
+
 export const useStore = create<Store>()(
     persist(
         (set) => ({
@@
             partialize: (state): PersistedState => ({ tasks: state.tasks }),
+            migrate: (persisted) => (isPersistedState(persisted) ? persisted : { tasks: seedTasks }),
         },
     ),
 );
```

`persist` hands `migrate` whatever it parsed, typed as `unknown`, since the file on disk could be anything. The guard checks what the app depends on, that `tasks` is an array, and returns the state untouched when that holds. When it does not, the file is from a version this build cannot read or was edited by hand, so you fall back to the seed instead of crashing on the first render.

Edit this function next time the shape changes.

## First run and seed data

`seedTasks` is the store's initial value, and `persist` overlays whatever it read from disk on top of it.

On a fresh install the file does not exist, `getItem` returns `null`, nothing is overlaid, and you see the seed. From the second launch on, the file exists and replaces `tasks` wholesale, so the seed is inert: a deleted seed task stays deleted and won't come back on the next start.

## Run it

Save `src/store/index.ts` and the open window picks up the persisted store. Add a task, then close the window. The dev server supervises the app process, so closing it also ends `npm run dev`. That fully exits the process, so anything held only in memory is gone.

Start it again:

```bash
npm run dev
```

Your task is still in the list, in the position you left it, with its checkbox and star as you set them. Tick one, quit, and start again, and the tick is there too.

The file is where you configured it:

```bash
ls ~/.local/share/com.gtkx.tutorial/
```

```
tasks.json
```

It is a single line of JSON, so read the task you just added with `jq`.

```bash
jq '.state.tasks[-1]' ~/.local/share/com.gtkx.tutorial/tasks.json
```

```json
{
  "id": "9f1c6ad2-1f8c-4d1e-9a3f-6c0f2e5b7a41",
  "listId": "personal",
  "title": "Buy oat milk",
  "notes": "",
  "done": false,
  "important": false,
  "deleted": false,
  "due": null,
  "position": 3,
  "createdAt": "2026-07-19T09:31:47.902Z",
  "completedAt": null
}
```

The document around it is `{"state":{"tasks":[...]},"version":1}`. `state` is what `partialize` returned, and `version` is the number `migrate` sees next time you change it. Run `jq .version` on the same file to confirm it is `1`.

Where that file lands depends on how the app was started:

| How you run it | Path |
| --- | --- |
| `npm run dev` or an installed build | `~/.local/share/com.gtkx.tutorial/tasks.json` |
| With `XDG_DATA_HOME` set | `$XDG_DATA_HOME/com.gtkx.tutorial/tasks.json` |
| Inside a Flatpak | `~/.var/app/com.gtkx.tutorial/data/com.gtkx.tutorial/tasks.json` |

## Next

[Lists and a Sidebar](/v2/tutorial/lists-and-the-sidebar) splits the store into slices and gives tasks a list to belong to, reachable from a sidebar.
