import { createRoot } from "@gtkx/react";
import { createElement } from "react";
import type { StorySource } from "./catalog.js";
import type { Preview } from "./types.js";
import { StoryCatalog } from "./catalog.js";
import { Storybook } from "./explorer-view.js";

type StorybookSession = {
    updateStories: (sources: StorySource[], preview?: Preview) => Promise<void>;
    reportStorybookError: (cause: unknown) => void;
    stop: () => void;
};

const startStorybook = (options: { applicationId: string }): StorybookSession => {
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
