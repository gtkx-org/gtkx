import type * as GObject from "@gtkx/gi/gobject";
import { dispatch, WidgetRegistry } from "@gtkx/cli/internal";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkListView, GtkNoSelection, GtkSignalListItemFactory } from "@gtkx/jsx/gtk";
import { render, screen, waitFor } from "@gtkx/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { applicationProps } from "../helpers/application.js";

type TreeProps = { tree: Gtk.TreeListModel };

const EXPANDABLE_ROOT = "alpha";
const LEAF_ROOT = "beta";
const ROOT_NAMES = [EXPANDABLE_ROOT, LEAF_ROOT];
const CHILD_NAMES = ["alpha-child"];
const boundExpanders: Map<string, Gtk.TreeExpander> = new Map();

const childModelFor = (item: GObject.Object): Gtk.StringList | null =>
    item instanceof Gtk.StringObject && item.getString() === EXPANDABLE_ROOT ? Gtk.StringList.new(CHILD_NAMES) : null;

const newTree = (): Gtk.TreeListModel =>
    Gtk.TreeListModel.new(Gtk.StringList.new(ROOT_NAMES), false, false, childModelFor);

const getCell = (object: GObject.Object): Gtk.TreeExpander | null => {
    const child = object instanceof Gtk.ListItem ? object.getChild() : null;

    return child instanceof Gtk.TreeExpander ? child : null;
};

const getRow = (object: GObject.Object): Gtk.TreeListRow | null => {
    const item = object instanceof Gtk.ListItem ? object.getItem() : null;

    return item instanceof Gtk.TreeListRow ? item : null;
};

const getRowText = (row: Gtk.TreeListRow): string => {
    const item = row.getItem();

    return item instanceof Gtk.StringObject ? item.getString() : "";
};

const setCellText = (expander: Gtk.TreeExpander, text: string): void => {
    const label = expander.getChild();

    if (label instanceof Gtk.Label) {
        label.setLabel(text);
    }
};

const handleSetup = (object: GObject.Object): void => {
    if (!(object instanceof Gtk.ListItem)) {
        return;
    }

    const expander = new Gtk.TreeExpander();
    expander.setChild(new Gtk.Label());
    object.setChild(expander);
};

const handleBind = (object: GObject.Object): void => {
    const expander = getCell(object);
    const row = getRow(object);

    if (expander === null || row === null) {
        return;
    }

    const text = getRowText(row);
    expander.setListRow(row);
    setCellText(expander, text);
    boundExpanders.set(text, expander);
};

const Tree = ({ tree }: TreeProps) => (
    <GtkListView
        model={<GtkNoSelection model={tree} />}
        factory={<GtkSignalListItemFactory onSetup={handleSetup} onBind={handleBind} />}
    />
);

const clickThroughMcp = async (widget: Gtk.Widget): Promise<void> => {
    const registry = new WidgetRegistry();
    registry.refresh();
    registry.register(widget);
    const app = new Gtk.Application(applicationProps());
    await dispatch("widget.click", { widgetId: registry.getOrCreateId(widget) }, { app, registry });
};

const findBoundExpander = async (text: string): Promise<Gtk.TreeExpander> => {
    await waitFor(() => {
        expect(boundExpanders.has(text)).toBe(true);
    });

    const expander = boundExpanders.get(text);

    if (expander === undefined) {
        throw new Error(`No tree expander was bound for "${text}"`);
    }

    return expander;
};

beforeEach(() => {
    boundExpanders.clear();
});

describe("widget.click on a tree expander", () => {
    it("expands the row behind the expander instead of acting on the enclosing list row", async () => {
        const tree = newTree();
        await render(<Tree tree={tree} />);
        const expander = await findBoundExpander(EXPANDABLE_ROOT);
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length);
        await clickThroughMcp(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(true);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length + CHILD_NAMES.length);
    });

    it("collapses the row again on a second click", async () => {
        const tree = newTree();
        await render(<Tree tree={tree} />);
        const expander = await findBoundExpander(EXPANDABLE_ROOT);
        await clickThroughMcp(expander);
        await clickThroughMcp(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length);
    });

    it("leaves a row that has no children unexpanded", async () => {
        const tree = newTree();
        await render(<Tree tree={tree} />);
        const expander = await findBoundExpander(LEAF_ROOT);
        await clickThroughMcp(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length);
    });
});

describe("widget.click on widgets that are not tree expanders", () => {
    it("still delivers a button click", async () => {
        const handleClicked = vi.fn();
        await render(<GtkButton label="Press" onClicked={handleClicked} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON);
        await clickThroughMcp(button);
        expect(handleClicked).toHaveBeenCalledTimes(1);
    });
});
