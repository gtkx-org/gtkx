import { composeStory } from "storybook/preview-api";
import type {
    ComponentMeta,
    ComposedStory,
    Preview,
    StoryAnnotations,
    StoryRender,
} from "./types.js";

type ComposeStory = <TArgs extends object>(
    ...annotations: [
        story: StoryAnnotations<TArgs>,
        meta: ComponentMeta<TArgs>,
        preview: Preview,
        renderer: { render: StoryRender<TArgs> },
        exportName?: string,
    ]
) => ComposedStory<TArgs>;

const composeStoryAnnotations = composeStory as ComposeStory;

export { composeStoryAnnotations };

export { isExportStory } from "storybook/internal/csf";
