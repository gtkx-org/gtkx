import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwLayout, AdwLayoutSlot, AdwMultiLayoutView } from "@gtkx/jsx/adw";
import { GtkBox, GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef, type ReactElement, type RefObject } from "react";
import { describe, expect, it } from "vitest";

type RenderedView = { view: Adw.MultiLayoutView; rerender: (layoutName: string) => Promise<void> };

const LAYOUTS = (
    <>
        <AdwLayout name="wide">
            <GtkBox orientation={Gtk.Orientation.HORIZONTAL}>
                <AdwLayoutSlot id="sidebar" />
                <AdwLayoutSlot id="content" />
            </GtkBox>
        </AdwLayout>
        <AdwLayout name="narrow">
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwLayoutSlot id="sidebar" />
                <AdwLayoutSlot id="content" />
            </GtkBox>
        </AdwLayout>
    </>
);

const buildView = (ref: RefObject<Adw.MultiLayoutView | null>, layoutName: string): ReactElement => (
    <AdwMultiLayoutView
        ref={ref}
        layoutName={layoutName}
        layouts={LAYOUTS}
        sidebarSlot={<GtkLabel>Side</GtkLabel>}
        contentSlot={<GtkLabel>Main</GtkLabel>}
    />
);

const renderView = async (layoutName: string): Promise<RenderedView> => {
    const ref = createRef<Adw.MultiLayoutView>();
    const { rerender } = await render(buildView(ref, layoutName));
    const { current } = ref;

    if (!current) {
        throw new TypeError("Expected a MultiLayoutView instance");
    }

    return { view: current, rerender: (next) => rerender(buildView(ref, next)) };
};

describe("render - AdwMultiLayoutView", () => {
    it("adds every layout declared in the layouts slot", async () => {
        const { view } = await renderView("wide");
        expect(view.getLayoutByName("wide")).not.toBeNull();
        expect(view.getLayoutByName("narrow")).not.toBeNull();
    });

    it("fills each AdwLayout with the content declared as its children", async () => {
        const { view } = await renderView("wide");
        expect(view.getLayoutByName("wide")?.getContent()).toBeInstanceOf(Gtk.Box);
        expect(view.getLayoutByName("narrow")?.getContent()).toBeInstanceOf(Gtk.Box);
    });

    it("places named slot children through the view", async () => {
        const { view } = await renderView("wide");
        expect(view.getChild("sidebar")).toHaveObjectProperty("label", "Side");
        expect(view.getChild("content")).toHaveObjectProperty("label", "Main");
        expect(await screen.findByText("Side")).toBeDefined();
        expect(await screen.findByText("Main")).toBeDefined();
    });

    it("applies layoutName once the named layout has attached", async () => {
        const { view } = await renderView("narrow");
        expect(view.getLayoutName()).toBe("narrow");
        expect(view.getLayout()).toBe(view.getLayoutByName("narrow"));
    });

    it("switches layout when layoutName changes", async () => {
        const { view, rerender } = await renderView("wide");
        expect(view.getLayoutName()).toBe("wide");
        await rerender("narrow");
        expect(view.getLayoutName()).toBe("narrow");
    });
});
