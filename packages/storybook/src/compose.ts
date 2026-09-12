import { createElement } from "react";
import type {
    Args,
    ComponentMeta,
    ComposedStories,
    ComposedStory,
    Preview,
    StoryAnnotations,
    StoryModule,
} from "./types.js";
import { composeStoryAnnotations, isExportStory } from "./upstream.js";

const requireObject = (value: unknown): void => {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
        throw new TypeError("Expected a CSF3 annotation object");
    }
};

const composeStory = <TArgs extends object>(
    story: StoryAnnotations<NoInfer<TArgs>>,
    meta: ComponentMeta<TArgs>,
    preview: Preview = {},
    exportName?: string,
): ComposedStory<TArgs> => {
    requireObject(story);
    requireObject(meta);
    requireObject(preview);

    if (!story.render && !meta.render && !preview.render && !meta.component) {
        throw new TypeError("A story needs a component or render function");
    }

    return composeStoryAnnotations(story, { ...meta }, preview, {
        render: (args) => {
            if (!meta.component) {
                throw new TypeError("A story needs a component or render function");
            }

            return createElement(meta.component, args);
        },
    }, exportName);
};

const composeStories = <TModule extends StoryModule>(
    stories: TModule,
    preview: Preview = {},
): ComposedStories<TModule> => {
    requireObject(stories);
    requireObject(stories.default);
    requireObject(preview);

    const meta = stories.default as ComponentMeta<Args>;
    const composed: Partial<ComposedStories<TModule>> = {};

    for (const [exportName, story] of Object.entries(stories)) {
        if (exportName === "default" || exportName === "__namedExportsOrder" || !isExportStory(exportName, meta)) {
            continue;
        }

        requireObject(story);
        Object.defineProperty(composed, exportName, {
            value: composeStory(story as StoryAnnotations<Args>, meta, preview, exportName),
            enumerable: true,
            configurable: true,
            writable: true,
        });
    }

    return composed as ComposedStories<TModule>;
};

export { composeStory, composeStories };
