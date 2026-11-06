import type { InputType } from "storybook/internal/types";
import { includeConditionalArg } from "storybook/internal/csf";
import { composeStory } from "storybook/preview-api";
import type { Args, ComponentMeta, ComposedStory, Preview, StoryAnnotations, StoryRender } from "./types.js";

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

const isConditionalArgIncluded: (argType: InputType, args: Args, globals: Args) => boolean = includeConditionalArg;

export { composeStoryAnnotations, isConditionalArgIncluded };

export { isExportStory, storyNameFromExport } from "storybook/internal/csf";
