---
description: "Persist the store to the XDG data directory so tasks survive a restart."
---

# Saving Tasks Between Runs

Keep the tasks from [the previous chapter](/v2/tutorial/completing-and-deleting) between launches. Zustand handles persistence; a file adapter connects it to the GTKX application's data directory.

## A storage backend

Store task content in the application's data directory. Preferences use GSettings, introduced in [Preferences and the System Theme](/v2/tutorial/preferences-and-theming).

Zustand's [`persist` middleware](https://zustand.docs.pmnd.rs/reference/middlewares/persist) accepts a custom storage adapter. GTKX runs on Node.js, so the adapter can use filesystem APIs directly.

Create `src/store/storage.ts`:

```ts
import { fileSetContents, getUserDataDir } from "@gtkx/gi/glib";
import type { StateStorage } from "zustand/middleware";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applicationId } from "virtual:gtkx-config";

const directory = join(getUserDataDir(), applicationId);
const file = join(directory, "tasks.json");

export const fileStorage: StateStorage = {
    getItem: () => {
        try {
            return readFileSync(file, "utf8");
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                return null;
            }

            throw error;
        }
    },
    setItem: (_name, value) => {
        mkdirSync(directory, { recursive: true });
        fileSetContents(file, Buffer.from(value));
    },
    removeItem: () => {
        rmSync(file, { force: true });
    },
};
```

GLib supplies the desktop data directory and replaces the saved file atomically. Only a missing file starts a fresh store; other read errors and write errors propagate to the application.

## Turning it on

Wrap the store creator from [Adding Tasks with a Store](/v2/tutorial/the-task-store) in `persist`. Nothing inside it changes.

The import line in `src/store/index.ts`:

```diff
 import { create } from "zustand";
+import { createJSONStorage, persist } from "zustand/middleware";
+import { fileStorage } from "./storage.js";
```

Then `src/store/index.ts`, with the action bodies left alone:

```ts
// ...

export type PersistedState = { tasks: Task[] };

let hydrationError: unknown;

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
            migrate: () => {
                throw new Error("Unsupported task data version");
            },
            onRehydrateStorage: () => (_state, error) => {
                hydrationError = error;
            },
        },
    ),
);

if (hydrationError !== undefined) {
    throw hydrationError;
}
```

`partialize` limits saved content to tasks. Later chapters add UI state that should reset when the app starts. The adapter uses one file, so it does not need the storage key passed as `name`.

Because this adapter is synchronous, saved tasks are loaded before the first render and each store update writes them to disk. On a fresh install, the list starts with `seedTasks`; an existing saved list, including an empty one, replaces those defaults.

The initialization check stops the app if loading or parsing fails, preserving the saved file. An unsupported format version also fails. When the app changes its saved format, replace that rejection with a migration; the [middleware documentation](https://zustand.docs.pmnd.rs/reference/middlewares/persist) covers that API.

## Run it

Save the files, add a task, and change its checkbox or star. Close the window, then start the app again:

```bash
npm run dev
```

The task and its changes remain. Delete a task and restart once more to check that it stays deleted.

With the default data directory, you can inspect the saved tasks:

```bash
jq .state.tasks ~/.local/share/com.gtkx.tutorial/tasks.json
```

If you set `XDG_DATA_HOME`, use that directory instead. The [packaging chapter](/v2/tutorial/packaging) covers running the same application in a Flatpak.

## Next

[Lists and a Sidebar](/v2/tutorial/lists-and-the-sidebar) splits the store into slices and gives tasks a list to belong to, reachable from a sidebar.
