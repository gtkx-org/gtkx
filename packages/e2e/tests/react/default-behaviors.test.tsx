import type { ReactNode } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwBin,
    AdwBottomSheet,
    AdwClamp,
    AdwClampScrollable,
    AdwEntryRow,
    AdwOverlaySplitView,
    AdwPreferencesDialog,
    AdwPreferencesGroup,
    AdwPreferencesPage,
    AdwShortcutsDialog,
    AdwShortcutsItem,
    AdwShortcutsSection,
    AdwSplitButton,
    AdwStatusPage,
    AdwTabOverview,
    AdwToastOverlay,
    AdwToggle,
    AdwToggleGroup,
    AdwWrapBox,
    AdwWindow,
} from "@gtkx/jsx/adw";
import {
    GtkActionBar,
    GtkAspectFrame,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkColumnView,
    GtkColumnViewColumn,
    GtkDropTarget,
    GtkExpander,
    GtkFlowBox,
    GtkFlowBoxChild,
    GtkFrame,
    GtkGraphicsOffload,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkListView,
    GtkMenuButton,
    GtkNoSelection,
    GtkPopover,
    GtkPopoverBin,
    GtkRevealer,
    GtkScrolledWindow,
    GtkSearchBar,
    GtkStringList,
    GtkTextView,
    GtkTreeExpander,
    GtkViewport,
    GtkWindowHandle,
} from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { ItemFactory } from "../helpers/list-view-render.js";

const containers: { name: string; wrap: (child: ReactNode) => ReactNode }[] = [
    { name: "AdwBin", wrap: (child) => <AdwBin>{child}</AdwBin> },
    { name: "AdwClamp", wrap: (child) => <AdwClamp>{child}</AdwClamp> },
    { name: "AdwSplitButton", wrap: (child) => <AdwSplitButton>{child}</AdwSplitButton> },
    { name: "AdwStatusPage", wrap: (child) => <AdwStatusPage>{child}</AdwStatusPage> },
    { name: "AdwTabOverview", wrap: (child) => <AdwTabOverview>{child}</AdwTabOverview> },
    { name: "AdwToastOverlay", wrap: (child) => <AdwToastOverlay>{child}</AdwToastOverlay> },
    {
        name: "AdwToggle",
        wrap: (child) => (
            <AdwToggleGroup>
                <AdwToggle>{child}</AdwToggle>
            </AdwToggleGroup>
        ),
    },
    { name: "GtkAspectFrame", wrap: (child) => <GtkAspectFrame>{child}</GtkAspectFrame> },
    { name: "GtkButton", wrap: (child) => <GtkButton>{child}</GtkButton> },
    { name: "GtkCheckButton", wrap: (child) => <GtkCheckButton>{child}</GtkCheckButton> },
    { name: "GtkExpander", wrap: (child) => <GtkExpander expanded>{child}</GtkExpander> },
    { name: "GtkFrame", wrap: (child) => <GtkFrame>{child}</GtkFrame> },
    {
        name: "GtkFlowBoxChild",
        wrap: (child) => (
            <GtkFlowBox>
                <GtkFlowBoxChild>{child}</GtkFlowBoxChild>
            </GtkFlowBox>
        ),
    },
    {
        name: "GtkListBoxRow",
        wrap: (child) => (
            <GtkListBox>
                <GtkListBoxRow>{child}</GtkListBoxRow>
            </GtkListBox>
        ),
    },
    { name: "GtkMenuButton", wrap: (child) => <GtkMenuButton>{child}</GtkMenuButton> },
    { name: "GtkPopover", wrap: (child) => <GtkMenuButton popover={<GtkPopover>{child}</GtkPopover>} /> },
    { name: "GtkPopoverBin", wrap: (child) => <GtkPopoverBin>{child}</GtkPopoverBin> },
    { name: "GtkGraphicsOffload", wrap: (child) => <GtkGraphicsOffload>{child}</GtkGraphicsOffload> },
    { name: "GtkRevealer", wrap: (child) => <GtkRevealer revealChild>{child}</GtkRevealer> },
    { name: "GtkSearchBar", wrap: (child) => <GtkSearchBar searchModeEnabled>{child}</GtkSearchBar> },
    { name: "GtkScrolledWindow", wrap: (child) => <GtkScrolledWindow>{child}</GtkScrolledWindow> },
    { name: "GtkTreeExpander", wrap: (child) => <GtkTreeExpander>{child}</GtkTreeExpander> },
    { name: "GtkViewport", wrap: (child) => <GtkViewport>{child}</GtkViewport> },
    { name: "GtkWindowHandle", wrap: (child) => <GtkWindowHandle>{child}</GtkWindowHandle> },
    { name: "AdwBottomSheet", wrap: (child) => <AdwBottomSheet>{child}</AdwBottomSheet> },
    { name: "AdwOverlaySplitView", wrap: (child) => <AdwOverlaySplitView>{child}</AdwOverlaySplitView> },
    { name: "AdwWindow", wrap: (child) => <AdwWindow title="Content host">{child}</AdwWindow> },
];

describe("default child adapters", () => {
    it.each(containers)("attaches, updates and removes $name content", async ({ wrap }) => {
        const ref = createRef<Gtk.Label>();
        const { rerender, unmount } = await render(wrap(<GtkLabel ref={ref}>Initial</GtkLabel>));
        const label = ref.current;
        expect(label?.getParent()).not.toBeNull();
        await rerender(wrap(<GtkLabel ref={ref}>Updated</GtkLabel>));
        expect(ref.current).toBe(label);
        expect(label?.getLabel()).toBe("Updated");
        await rerender(wrap(null));
        expect(ref.current).toBeNull();
        expect(label?.getRoot()).toBeNull();
        await unmount();
    });

    it("accepts a scrollable widget and replaces it without retaining the old child", async () => {
        const ref = createRef<Adw.ClampScrollable>();
        const view = (key: string) => (
            <AdwClampScrollable ref={ref}>
                <GtkTextView key={key} />
            </AdwClampScrollable>
        );
        const { rerender } = await render(view("first"));
        const first = ref.current?.getChild();
        expect(first).toBeInstanceOf(Gtk.TextView);
        await rerender(view("second"));
        expect(ref.current?.getChild()).not.toBe(first);
        expect(first?.getParent()).toBeNull();
    });

    it.each([
        { name: "AdwWrapBox", wrap: (children: ReactNode) => <AdwWrapBox>{children}</AdwWrapBox> },
        { name: "GtkBox", wrap: (children: ReactNode) => <GtkBox>{children}</GtkBox> },
        { name: "GtkListBox", wrap: (children: ReactNode) => <GtkListBox>{children}</GtkListBox> },
        { name: "GtkFlowBox", wrap: (children: ReactNode) => <GtkFlowBox>{children}</GtkFlowBox> },
    ])("orders, inserts and removes $name children", async ({ wrap: container }) => {
        const wrap = (names: string[]) => container(names.map((name) => <GtkLabel key={name}>{name}</GtkLabel>));
        const { rerender } = await render(wrap(["A", "B"]));
        const first = screen.getByText("A");
        await rerender(wrap(["B", "C", "A"]));
        expect(screen.getByText("B")).toAppearBefore(screen.getByText("C"));
        expect(screen.getByText("C")).toAppearBefore(first);
        await rerender(wrap(["C"]));
        expect(screen.queryByText("A")).toBeNull();
        expect(screen.queryByText("B")).toBeNull();
    });
});

describe("default slots and non-widget children", () => {
    it("renders and updates children in native list items and section headers", async () => {
        const strings = ["one", "two"];
        const list = (prefix: string) => (
            <GtkListView
                model={<GtkNoSelection model={<GtkStringList strings={strings} />} />}
                factory={
                    <ItemFactory
                        renderItem={(item) => (
                            <GtkLabel>
                                {item instanceof Gtk.StringObject ? `${prefix} ${item.getString()}` : "Invalid item"}
                            </GtkLabel>
                        )}
                    />
                }
                headerFactory={<ItemFactory renderItem={() => <GtkLabel>{prefix} header</GtkLabel>} />}
            />
        );
        const { rerender, unmount } = await render(list("Initial"));
        expect(await screen.findByText("Initial one")).toBeVisible();
        expect(await screen.findByText("Initial header")).toBeVisible();
        await rerender(list("Updated"));
        expect(await screen.findByText("Updated two")).toBeVisible();
        expect(await screen.findByText("Updated header")).toBeVisible();
        expect(screen.queryByText("Initial one")).toBeNull();
        await unmount();
        expect(screen.queryByText("Updated header")).toBeNull();
    });

    it("updates and removes action-bar and entry-row slots", async () => {
        const contents = (show: boolean) => (
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkActionBar start={show && <GtkLabel>Start</GtkLabel>} end={<GtkLabel>End</GtkLabel>} />
                <AdwEntryRow
                    title="Entry"
                    prefix={show && <GtkLabel>Prefix</GtkLabel>}
                    suffix={<GtkLabel>Suffix</GtkLabel>}
                />
            </GtkBox>
        );
        const { rerender } = await render(contents(true));
        expect(screen.getByText("Start")).toBeVisible();
        expect(screen.getByText("Prefix")).toBeVisible();
        await rerender(contents(false));
        expect(screen.queryByText("Start")).toBeNull();
        expect(screen.queryByText("Prefix")).toBeNull();
        expect(screen.getByText("End")).toBeVisible();
        expect(screen.getByText("Suffix")).toBeVisible();
    });

    it("updates the accepted native types of a drop controller", async () => {
        const ref = createRef<Gtk.DropTarget>();
        const target = (types: bigint[]) => (
            <GtkLabel controllers={<GtkDropTarget ref={ref} types={types} />}>Drop here</GtkLabel>
        );
        const { rerender, unmount } = await render(target([GObject.TYPE_STRING]));
        const controller = ref.current;
        expect(controller?.getGtypes()).toEqual([GObject.TYPE_STRING]);
        expect(controller?.getWidget()).toBe(screen.getByText("Drop here"));
        await rerender(target([GObject.TYPE_INT]));
        expect(controller?.getGtypes()).toEqual([GObject.TYPE_INT]);
        await unmount();
        expect(controller?.getWidget()).toBeNull();
    });

    it("keeps column objects ordered through insertion and removal", async () => {
        const ref = createRef<Gtk.ColumnView>();
        const columns = (titles: string[]) => (
            <GtkColumnView ref={ref}>
                {titles.map((title) => (
                    <GtkColumnViewColumn key={title} title={title} />
                ))}
            </GtkColumnView>
        );
        const { rerender } = await render(columns(["A", "B"]));
        const model = ref.current?.getColumns();
        const first = model?.getItem(0);
        await rerender(columns(["B", "C", "A"]));
        expect(model?.getNItems()).toBe(3);
        expect(model?.getItem(2)).toBe(first);
        await rerender(columns(["C"]));
        expect(model?.getNItems()).toBe(1);
        expect(model?.getItem(0)).toHaveObjectProperty("title", "C");
    });

    it("adds preferences pages and detaches removed pages", async () => {
        const ref = createRef<Adw.PreferencesDialog>();
        const dialog = (title: string) => (
            <AdwPreferencesDialog ref={ref}>
                <AdwPreferencesPage key={title} title={title}>
                    <AdwPreferencesGroup>
                        <GtkLabel>{title} settings</GtkLabel>
                    </AdwPreferencesGroup>
                </AdwPreferencesPage>
            </AdwPreferencesDialog>
        );
        const { rerender } = await render(dialog("First"));
        expect(await screen.findByText("First settings")).toBeVisible();
        await rerender(dialog("Second"));
        expect(await screen.findByText("Second settings")).toBeVisible();
        expect(screen.queryByText("First settings")).toBeNull();
    });

    it("renders shortcut sections and their items through the dialog", async () => {
        await render(
            <AdwShortcutsDialog>
                <AdwShortcutsSection title="Editing">
                    <AdwShortcutsItem title="Copy selection" accelerator="<Control>c" />
                </AdwShortcutsSection>
            </AdwShortcutsDialog>,
        );
        expect(await screen.findByText("Copy selection")).toBeVisible();
        expect(screen.getByText("Editing")).toBeVisible();
    });
});
