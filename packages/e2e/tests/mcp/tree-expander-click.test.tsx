import { dispatch } from "@gtkx/cli/internal";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkNoSelection } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
    CHILD_NAMES,
    EXPANDABLE_ROOT,
    findBoundExpander,
    LEAF_ROOT,
    newTree,
    renderTree,
    resetTree,
    ROOT_NAMES,
} from "../helpers/tree-list-render.js";
import { contextFor } from "./dispatch-context.js";

type BoundRow = { expander: Gtk.TreeExpander; tree: Gtk.TreeListModel };

const clickThroughMcp = async (widget: Gtk.Widget): Promise<void> => {
    const context = contextFor(widget);
    await dispatch("widget.click", { widgetId: context.registry.getOrCreateId(widget) }, context);
};

const renderBoundTree = async (name: string): Promise<BoundRow> => {
    const tree = newTree();
    await renderTree(<GtkNoSelection model={tree} />);

    return { expander: await findBoundExpander(name), tree };
};

beforeEach(resetTree);

describe("widget.click on a tree expander", () => {
    it("expands the row behind the expander instead of acting on the enclosing list row", async () => {
        const { expander, tree } = await renderBoundTree(EXPANDABLE_ROOT);
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length);
        await clickThroughMcp(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(true);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length + CHILD_NAMES.length);
    });

    it("collapses the row again on a second click", async () => {
        const { expander, tree } = await renderBoundTree(EXPANDABLE_ROOT);
        await clickThroughMcp(expander);
        await clickThroughMcp(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length);
    });

    it("leaves a row that has no children unexpanded", async () => {
        const { expander, tree } = await renderBoundTree(LEAF_ROOT);
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
