import { createRoot } from "@gtkx/react";
import { createElement } from "react";
import type { StorySource } from "./catalog.js";
import type { Preview } from "./types.js";
import { StoryCatalog } from "./catalog.js";
import { Storybook } from "./explorer-view.js";

/** Controls a running native Storybook explorer and its source catalog. */
type StorybookSession = {
    /** Replaces discovered sources and preview annotations, rejecting if any source fails to load. */
    updateStories: (sources: StorySource[], preview?: Preview) => Promise<void>;
    /** Displays a session failure while keeping successfully loaded stories available. */
    reportStorybookError: (cause: unknown) => void;
    /** Unmounts the explorer and its story windows or dialogs. */
    stop: () => void;
};

/** Starts a native explorer and returns the handle used to load stories and stop it. */
const startStorybook = (options: {
    /** Gio application identifier assigned to the explorer application. */
    applicationId: string;
}): StorybookSession => {
    const catalog = new StoryCatalog();
    const root = createRoot(undefined, { onUncaughtError: catalog.reportError.bind(catalog) });
    root.render(createElement(Storybook, { catalog, applicationId: options.applicationId }));

    return {
        updateStories: (sources, preview) => catalog.load(sources, preview),
        reportStorybookError: (cause) => {
            catalog.reportError(cause);
        },
        stop: () => {
            root.unmount();
        },
    };
};

export { startStorybook };
export type { StorybookSession };
export type { StoryCatalogSnapshot, StoryEntry, StoryLoadError, StorySource } from "./catalog.js";

export { StoryCatalog } from "./catalog.js";

export { Storybook } from "./explorer-view.js";
