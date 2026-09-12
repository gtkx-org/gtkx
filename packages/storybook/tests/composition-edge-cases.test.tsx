import type { Meta, StoryObj } from "@gtkx/storybook";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { composeStories, composeStory } from "@gtkx/storybook";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { Counter } from "./fixtures/counter.js";
import * as stories from "./fixtures/counter.stories.js";

describe("portable native story edge cases", () => {
    it("keeps export-based IDs separate from display names", async () => {
        const { Named, WithStep } = composeStories(stories);
        const result = await render(<Named />);

        expect(Named.id).toBe("components-counter--named");
        expect(Named.storyName).toBe("Named");
        expect(screen.getByName("story-context")).toHaveTextContent(
            "components-counter--named|Count by five!|Add five",
        );
        expect(WithStep.id).toBe("components-counter--with-step");
        expect(WithStep.storyName).toBe("WithStep");

        await result.rerender(<WithStep />);

        expect(screen.getByName("story-context")).toHaveTextContent(
            "components-counter--with-step|With Step|Increment",
        );
    });

    it("uses an explicit meta ID for single-story composition", async () => {
        const Story = composeStory(stories.Named, { ...stories.default, id: "custom-counter" }, undefined, "Named");
        await render(<Story />);

        expect(Story.id).toBe("custom-counter--named");
        expect(Story.storyName).toBe("Named");
        expect(screen.getByName("story-context")).toHaveTextContent("custom-counter--named|Count by five!");
    });

    it("composes frozen metadata through both public APIs", async () => {
        const meta = Object.freeze({ ...stories.default });
        const Single = composeStory(stories.Default, meta, undefined, "Default");
        const { Named } = composeStories({ ...stories, default: meta });
        const result = await render(<Single />);

        expect(screen.getByName("story-context")).toHaveTextContent(
            "components-counter--default|Default|Increment",
        );

        await result.rerender(<Named label="Frozen metadata" />);

        expect(screen.getByName("story-context")).toHaveTextContent(
            "components-counter--named|Count by five!|Frozen metadata",
        );
        expect(meta.title).toBe("Components/Counter");
    });

    it.each([
        { includeStories: ["Default", "Named"], excludeStories: ["Named"] },
        { includeStories: /^(Default|Named)$/, excludeStories: /^Named$/ },
    ])("honors module export filters", async (filters) => {
        const composed = composeStories({
            ...stories,
            default: { ...stories.default, ...filters },
            helperData: { label: "Not a story" },
        });
        await render(<composed.Default />);

        expect(Object.keys(composed)).toEqual(["Default"]);
        expect(screen.getByName("count")).toHaveTextContent(/^2$/);
    });

    it("returns no stories for empty or entirely excluded modules", () => {
        expect(composeStories({ default: stories.default })).toEqual({});
        expect(composeStories({ ...stories, default: { ...stories.default, includeStories: [] } })).toEqual({});
    });

    it("prefers story render over meta render and meta render over the component", async () => {
        const meta = {
            title: "Rendering/Counter",
            component: Counter,
            args: { initialCount: 1, label: "Custom", step: 2 },
            render: (args) => <GtkLabel>{`Meta: ${args.label}`}</GtkLabel>,
        } satisfies Meta<typeof Counter>;
        const story = {
            render: (args) => <GtkLabel>{`Story: ${args.label}, step ${String(args.step)}`}</GtkLabel>,
        } satisfies StoryObj<typeof meta>;
        const MetaRender = composeStory({}, meta, undefined, "MetaRender");
        const StoryRender = composeStory(story, meta, undefined, "StoryRender");
        const result = await render(<MetaRender />);

        expect(screen.getByText("Meta: Custom")).toBeVisible();

        await result.rerender(<StoryRender label="Override" step={4} />);

        expect(screen.getByText("Story: Override, step 4")).toBeVisible();
    });

    it("renders args-based stories without a component declaration", async () => {
        const meta = {
            title: "Rendering/Label",
            args: { label: "Meta label" },
            render: (args) => <GtkLabel>{args.label}</GtkLabel>,
        } satisfies Meta<{ label: string }>;
        const story = { args: { label: "Story label" } } satisfies StoryObj<typeof meta>;
        const Story = composeStory(story, meta, undefined, "Label");
        const result = await render(<Story />);

        expect(screen.getByText("Story label")).toBeVisible();

        await result.rerender(<Story label="Override label" />);

        expect(screen.getByText("Override label")).toBeVisible();
    });
});
