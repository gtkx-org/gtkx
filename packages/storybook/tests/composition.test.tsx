import type { Preview, StoryObj } from "@gtkx/storybook";
import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel } from "@gtkx/jsx/gtk";
import { composeStories, composeStory } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { useCallback, useState } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { CounterProps } from "./fixtures/counter.js";
import { Counter, Decoration } from "./fixtures/counter.js";
import * as stories from "./fixtures/counter.stories.js";

const preview = {
    args: { caption: "Preview caption", initialCount: 0, label: "Preview increment", step: 9 },
    argTypes: { caption: { control: "text" } },
    parameters: {
        layout: "preview",
        previewOnly: true,
        theme: { density: "comfortable", contrast: "low" },
    },
    initialGlobals: { language: "en", theme: "light" },
    decorators: [
        (Story) => (
            <Decoration label="preview">
                <Story />
            </Decoration>
        ),
    ],
} satisfies Preview;

describe("portable native stories", () => {
    it("renders a CSF component and updates its state through native clicks", async () => {
        const { Default } = composeStories(stories);
        expectTypeOf(Default).parameter(0).toEqualTypeOf<Partial<CounterProps>>();
        expectTypeOf(Default.args).toEqualTypeOf<Partial<CounterProps>>();
        expectTypeOf<Record<never, never>>().toExtend<StoryObj<typeof stories.default>>();
        expectTypeOf<{ args: { label: string; initialCount: number } }>()
            .not.toExtend<StoryObj<{ component: typeof Counter }>>();
        await render(<Default />);

        expect(screen.getByName("count")).toHaveTextContent(/^2$/);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);
    });

    it("overrides composed args on rerender while preserving React state", async () => {
        const { WithStep } = composeStories(stories);
        const result = await render(<WithStep />);

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^5$/);

        await result.rerender(<WithStep label="Add ten" step={10} caption="Updated caption" />);

        expect(screen.getByName("count")).toHaveTextContent(/^5$/);
        expect(screen.getByName("caption")).toHaveTextContent("Updated caption");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Add ten" }));
        expect(screen.getByName("count")).toHaveTextContent(/^15$/);

        await result.rerender(<WithStep />);

        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^18$/);
        expect(WithStep.args).toEqual({ initialCount: 2, label: "Increment", step: 3 });
        expect(stories.WithStep.args).toEqual({ step: 3 });
    });

    it("combines preview, meta, and story annotations in the native tree", async () => {
        const Decorated = composeStory(stories.Decorated, stories.default, preview, "Decorated");
        await render(<Decorated />);

        expect(screen.getByName("count")).toHaveTextContent(/^4$/);
        expect(screen.getByName("caption")).toHaveTextContent("Preview caption");
        expect(screen.getByName("decorator-order")).toHaveTextContent("/preview/meta/story");
        expect(screen.getByName("story-context")).toHaveTextContent(
            "components-counter--decorated|Decorated|Story increment|story|dark|it",
        );
        expect(Decorated.args).toEqual({
            caption: "Preview caption",
            initialCount: 4,
            label: "Story increment",
            step: 1,
        });
        expect(Decorated.argTypes).toMatchObject({
            caption: { control: { type: "text" } },
            label: { control: { type: "text" } },
            step: { control: { type: "number" } },
        });
        expect(Decorated.parameters).toMatchObject({
            layout: "story",
            metaOnly: true,
            previewOnly: true,
            theme: { contrast: "high", density: "compact" },
        });
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Story increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^5$/);
    });

    it("exposes render overrides to decorators without changing composed defaults", async () => {
        const { Decorated } = composeStories(stories, preview);
        await render(<Decorated label="Override increment" />);

        expect(screen.getByName("story-context")).toHaveTextContent(
            "components-counter--decorated|Decorated|Override increment|story|dark|it",
        );
        expect(Decorated.args.label).toBe("Story increment");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Override increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^5$/);
    });

    it("cleans up effects when a story unmounts and restores its initial state on remount", async () => {
        const { Default } = composeStories(stories);

        const Lifecycle = (): ReactNode => {
            const [isVisible, setIsVisible] = useState(true);
            const [active, setActive] = useState(0);
            const onActivityChange = useCallback((change: number) => {
                setActive((value) => value + change);
            }, []);

            return (
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton
                        label="Toggle story"
                        onClicked={() => {
                            setIsVisible((value) => !value);
                        }}
                    />
                    <GtkLabel name="active-stories">{String(active)}</GtkLabel>
                    {isVisible && <Default onActivityChange={onActivityChange} />}
                </GtkBox>
            );
        };

        await render(<Lifecycle />);

        expect(screen.getByName("active-stories")).toHaveTextContent(/^1$/);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Toggle story" }));
        expect(screen.getByName("active-stories")).toHaveTextContent(/^0$/);
        expect(screen.queryByName("count")).toBeNull();
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Toggle story" }));
        expect(screen.getByName("active-stories")).toHaveTextContent(/^1$/);
        expect(screen.getByName("count")).toHaveTextContent(/^2$/);
    });
});
