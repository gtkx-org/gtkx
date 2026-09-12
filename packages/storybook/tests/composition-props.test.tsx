import type { Meta, StoryObj } from "@gtkx/storybook";
import type { ReactNode, RefAttributes } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { composeStories, composeStory } from "@gtkx/storybook";
import { render, screen, userEvent } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, expectTypeOf, it } from "vitest";
import type { CounterProps } from "./fixtures/counter.js";
import { Counter } from "./fixtures/counter.js";

type CustomCounterProps = CounterProps & { suffix: string };

const RefLabel = ({ ref }: RefAttributes<Gtk.Label>): ReactNode => <GtkLabel ref={ref}>Interface props</GtkLabel>;

describe("portable native story props", () => {
    it("infers interface-based component props and forwards native refs", async () => {
        const initialRef = createRef<Gtk.Label>();
        const overrideRef = createRef<Gtk.Label>();
        const meta = {
            title: "Props/Interface",
            component: RefLabel,
            args: { ref: initialRef },
        } satisfies Meta<typeof RefLabel>;
        const story = {} satisfies StoryObj<typeof meta>;
        const { Default } = composeStories({ default: meta, Default: story });
        expectTypeOf(Default).parameter(0).toEqualTypeOf<Partial<RefAttributes<Gtk.Label>>>();
        const result = await render(<Default />);

        expect(screen.getByText("Interface props")).toBeVisible();
        expect(initialRef.current).toBeInstanceOf(Gtk.Label);

        await result.rerender(<Default ref={overrideRef} />);

        expect(initialRef.current).toBeNull();
        expect(overrideRef.current).toBeInstanceOf(Gtk.Label);
    });

    it("infers custom render args alongside component props", async () => {
        const meta = {
            title: "Props/CustomRender",
            component: Counter,
            args: { initialCount: 2, label: "Increment", step: 1 },
            render: (args) => (
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <Counter {...args} />
                    <GtkLabel name="suffix">{args.suffix}</GtkLabel>
                </GtkBox>
            ),
        } satisfies Meta<CustomCounterProps>;
        const story = { args: { suffix: "Story suffix" } } satisfies StoryObj<typeof meta>;
        const { Custom } = composeStories({ default: meta, Custom: story });
        const Single = composeStory(story, meta, undefined, "Custom");
        expectTypeOf(Custom).parameter(0).toHaveProperty("suffix").toEqualTypeOf<string | undefined>();
        expectTypeOf(Single).parameter(0).toHaveProperty("suffix").toEqualTypeOf<string | undefined>();
        expectTypeOf<Record<never, never>>().not.toExtend<StoryObj<typeof meta>>();
        const result = await render(<Custom />);

        expect(screen.getByName("suffix")).toHaveTextContent("Story suffix");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);

        await result.rerender(<Single suffix="Override suffix" />);

        expect(screen.getByName("suffix")).toHaveTextContent("Override suffix");
    });

    it("infers custom decorator args alongside component props", async () => {
        const meta = {
            title: "Props/CustomDecorator",
            component: Counter,
            args: { initialCount: 2, label: "Increment", step: 1 },
            decorators: [
                (Story, context) => (
                    <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                        <GtkLabel name="suffix">{context.args.suffix}</GtkLabel>
                        <Story />
                    </GtkBox>
                ),
            ],
        } satisfies Meta<CustomCounterProps>;
        const story = { args: { suffix: "Decorator suffix" } } satisfies StoryObj<typeof meta>;
        const { Custom } = composeStories({ default: meta, Custom: story });
        const Single = composeStory(story, meta, undefined, "Custom");
        expectTypeOf(Custom).parameter(0).toHaveProperty("suffix").toEqualTypeOf<string | undefined>();
        expectTypeOf(Single).parameter(0).toHaveProperty("suffix").toEqualTypeOf<string | undefined>();
        expectTypeOf<Record<never, never>>().not.toExtend<StoryObj<typeof meta>>();
        const result = await render(<Custom />);

        expect(screen.getByName("suffix")).toHaveTextContent("Decorator suffix");
        await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Increment" }));
        expect(screen.getByName("count")).toHaveTextContent(/^3$/);

        await result.rerender(<Single suffix="Override suffix" />);

        expect(screen.getByName("suffix")).toHaveTextContent("Override suffix");
    });
});
