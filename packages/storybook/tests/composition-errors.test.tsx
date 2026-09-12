import type { Meta, StoryObj } from "@gtkx/storybook";
import type { ReactNode } from "react";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { composeStories, composeStory } from "@gtkx/storybook";
import { render } from "@gtkx/testing";
import { describe, expect, it } from "vitest";

describe("portable native story errors", () => {
    it("rejects a module with null component annotations", () => {
        expect(() => composeStories({ default: null })).toThrow();
    });

    it.each([42, () => <GtkLabel>Function story</GtkLabel>])("rejects non-object story exports", (Broken) => {
        const meta = {
            title: "Errors/InvalidStory",
            render: () => <GtkLabel>Content</GtkLabel>,
        } satisfies Meta;

        expect(() => composeStories({ default: meta, Broken })).toThrow();
    });

    it("rejects a story with no render function or component", async () => {
        await expect(async () => {
            const Story = composeStory({}, { title: "Errors/Missing" }, undefined, "Missing");
            await render(<Story />);
        }).rejects.toThrow();
    });

    it("propagates errors from a story render", async () => {
        const meta = { title: "Errors/Render" } satisfies Meta;
        const story = {
            render: (): ReactNode => {
                throw new Error("Render failed");
            },
        } satisfies StoryObj<typeof meta>;
        const Story = composeStory(story, meta, undefined, "Broken");

        await expect(render(<Story />)).rejects.toThrow();
    });

    it("propagates errors from a story decorator", async () => {
        const meta = {
            title: "Errors/Decorator",
            render: () => <GtkLabel>Content</GtkLabel>,
        } satisfies Meta;
        const story = {
            decorators: [
                (): ReactNode => {
                    throw new Error("Decorator failed");
                },
            ],
        } satisfies StoryObj<typeof meta>;
        const Story = composeStory(story, meta, undefined, "Broken");

        await expect(render(<Story />)).rejects.toThrow();
    });
});
