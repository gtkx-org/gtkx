import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkMenuButton, GtkPopover, GtkStack, GtkStackPage } from "@gtkx/jsx/gtk";
import { createRef, type ReactNode, type RefObject } from "react";
import { describe, expect, it } from "vitest";
import { act, prettyWidget, render, screen, within } from "../src/index.js";

type StackFixture = {
    stack: Gtk.Stack;
    container: Gtk.Widget;
};

type PopoverFixture = {
    popover: Gtk.Popover;
    container: Gtk.Widget;
};

const popoverMenuButton = (popoverRef: RefObject<Gtk.Popover | null>): ReactNode => (
    <GtkMenuButton label="Open">
        <GtkPopover ref={popoverRef}>
            <GtkLabel>Inside the popover</GtkLabel>
        </GtkPopover>
    </GtkMenuButton>
);

const renderStack = async (): Promise<StackFixture> => {
    const stackRef = createRef<Gtk.Stack>();

    const { container } = await render(
        <GtkStack ref={stackRef}>
            <GtkStackPage name="first">
                <GtkButton label="On top" />
            </GtkStackPage>
            <GtkStackPage name="second">
                <GtkButton label="Behind" />
            </GtkStackPage>
        </GtkStack>,
    );

    return { stack: stackRef.current as Gtk.Stack, container };
};

const renderAroundPopover = async (
    build: (popoverRef: RefObject<Gtk.Popover | null>) => ReactNode,
): Promise<PopoverFixture> => {
    const popoverRef = createRef<Gtk.Popover>();
    const { container } = await render(build(popoverRef));

    return { popover: popoverRef.current as Gtk.Popover, container };
};

const renderPopover = (): Promise<PopoverFixture> =>
    renderAroundPopover((popoverRef) => (
        <GtkBox orientation={Gtk.Orientation.VERTICAL}>{popoverMenuButton(popoverRef)}</GtkBox>
    ));

const renderStackedPopover = (): Promise<PopoverFixture> =>
    renderAroundPopover((popoverRef) => (
        <GtkStack>
            <GtkStackPage name="first">
                <GtkLabel>On top</GtkLabel>
            </GtkStackPage>
            <GtkStackPage name="second">{popoverMenuButton(popoverRef)}</GtkStackPage>
        </GtkStack>
    ));

const settle = async (action: () => void): Promise<void> => {
    await act(async () => {
        action();
        await Promise.resolve();
    });
};

describe("queries over a Gtk.Stack", () => {
    it("skips a widget on a non-visible page, whatever the query family", async () => {
        await renderStack();
        expect(screen.queryByText("Behind")).toBeNull();
        expect(screen.queryByName("Behind")).toBeNull();
        expect(screen.queryByLabelText("Behind")).toBeNull();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Behind" })).toBeNull();
        expect(screen.queryByText("On top")).not.toBeNull();
    });

    it("keeps skipping it when hidden is set, because hidden only relaxes accessibility", async () => {
        await renderStack();
        expect(screen.queryByRole(Gtk.AccessibleRole.BUTTON, { name: "Behind", hidden: true })).toBeNull();
    });

    it("matches the widget once its page becomes visible", async () => {
        const { stack } = await renderStack();

        await settle(() => {
            stack.setVisibleChildName("second");
        });

        expect(await screen.findByText("Behind")).toBeDefined();
        expect(screen.queryByText("On top")).toBeNull();
    });
});

describe("queries over a Gtk.Popover", () => {
    it("skips a widget inside a closed popover and matches it once it pops up", async () => {
        const { popover } = await renderPopover();
        expect(screen.queryByText("Inside the popover")).toBeNull();
        expect(within(popover).queryAllByText("Inside the popover")).toHaveLength(0);

        await settle(() => {
            popover.popup();
        });

        expect(await screen.findByText("Inside the popover")).toBeDefined();
        expect(within(popover).queryAllByText("Inside the popover")).toHaveLength(1);

        await settle(() => {
            popover.popdown();
        });

        expect(screen.queryByText("Inside the popover")).toBeNull();
    });

    it("matches a mapped popover raised from a widget on a non-visible page", async () => {
        const { popover } = await renderStackedPopover();
        expect(screen.queryByText("Open")).toBeNull();

        await settle(() => {
            popover.popup();
        });

        expect(popover.getMapped()).toBe(true);
        expect(await screen.findByText("Inside the popover")).toBeDefined();
        expect(screen.queryByText("Open")).toBeNull();
    });
});

describe("prettyWidget over unmapped widgets", () => {
    it("marks an unmapped widget and summarizes a subtree that holds nothing mapped", async () => {
        const { container } = await renderStack();
        const output = prettyWidget(container, { shouldHighlight: false });
        expect(output).toContain("mapped=\"false\"");
        expect(output).toContain("child widget not mapped");
        expect(output).not.toContain("<Label name=\"GtkLabel\" role=\"label\">\n        Behind");
    });

    it("keeps descending through an unmapped subtree that still holds a mapped widget", async () => {
        const { popover, container } = await renderStackedPopover();

        await settle(() => {
            popover.popup();
        });

        const output = prettyWidget(container, { shouldHighlight: false });
        expect(output).toContain("mapped=\"false\"");
        expect(output).toContain("Inside the popover");
    });
});
