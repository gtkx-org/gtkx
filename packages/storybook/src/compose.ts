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

/**
 * Composes a CSF3 story into a native React component with resolved defaults and decorators.
 * Compose outside render to preserve component identity. Rendering props override the composed args.
 * This function does not create an application, window, or Storybook preview lifecycle.
 *
 * @param story The named story's annotations.
 * @param meta The module's default component metadata.
 * @param preview Shared project annotations, scoped to this composition.
 * @param exportName Export name used for the story identifier and default display name.
 * @returns A renderable component exposing its composed annotations.
 * @throws If an annotation is not an object or no component or render function is available.
 */
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

/**
 * Composes the selected CSF3 exports of a module into native React components.
 * The default export supplies metadata; its includeStories and excludeStories select named exports.
 * Returned keys retain the original export names.
 *
 * @param stories A story module containing default metadata and named story objects.
 * @param preview Shared project annotations, scoped to the returned compositions.
 * @returns Composed components keyed by the selected export names.
 * @throws If metadata or a selected export is invalid, or a selected story has no renderer.
 */
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
