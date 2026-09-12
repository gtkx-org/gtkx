import type { Meta, Preview, StoryObj } from "@gtkx/storybook";
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
    it("infers default args when the renderer is supplied by the preview", async () => {
        const meta = {
            title: "Props/PreviewRender",
            args: { label: "Meta label" },
        } satisfies Meta<{ label: string }>;
        const preview = {
            render: (args) => <GtkLabel>{String(args.label)}</GtkLabel>,
        } satisfies Preview;
        const story = { args: { label: "Story label" } } satisfies StoryObj<typeof meta>;
        const { Default, Custom } = composeStories({ default: meta, Default: {}, Custom: story }, preview);
        expectTypeOf(Default).parameter(0).toEqualTypeOf<{ label?: string }>();
        expectTypeOf(Default.args).toEqualTypeOf<{ label?: string }>();
        expectTypeOf<Record<never, never>>().toExtend<StoryObj<typeof meta>>();
        expectTypeOf<{ args: { label: number } }>().not.toExtend<StoryObj<typeof meta>>();
        const result = await render(<Default />);

        expect(screen.getByText("Meta label")).toBeVisible();
        await result.rerender(<Custom />);
        expect(screen.getByText("Story label")).toBeVisible();
        await result.rerender(<Custom label="Override label" />);
        expect(screen.getByText("Override label")).toBeVisible();
    });

    it("preserves explicit props in story args and render functions", async () => {
        const meta = {
            title: "Props/Explicit",
            args: { label: "Meta label" },
        } satisfies Meta<{ label: string }>;
        const story = {
            args: { label: "Story label" },
            render: (args) => {
                expectTypeOf(args).toEqualTypeOf<{ label: string }>();

                return <GtkLabel>{args.label}</GtkLabel>;
            },
        } satisfies StoryObj<{ label: string }>;
        const Story = composeStory(story, meta, undefined, "Explicit");
        expectTypeOf<NonNullable<StoryObj<{ label: string }>["args"]>>().toEqualTypeOf<{ label?: string }>();
        expectTypeOf<{ args: { label: number } }>().not.toExtend<StoryObj<{ label: string }>>();
        expectTypeOf(Story).parameter(0).toEqualTypeOf<{ label?: string }>();
        const result = await render(<Story />);

        expect(screen.getByText("Story label")).toBeVisible();
        await result.rerender(<Story label="Override label" />);
        expect(screen.getByText("Override label")).toBeVisible();
    });

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
