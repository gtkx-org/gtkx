import * as Gtk from "@gtkx/gi/gtk";
import { GtkMultiSelection } from "@gtkx/jsx/gtk";
import { screen, userEvent } from "@gtkx/testing";
import { beforeEach, describe, expect, it } from "vitest";
import { attachClickGesture } from "../helpers/click-gesture.js";
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

type TreeFixture = { tree: Gtk.TreeListModel; expander: Gtk.TreeExpander; selection: Gtk.MultiSelection };

const renderFixture = async (rootName: string, isExpanderHidden = false): Promise<TreeFixture> => {
    const tree = newTree();
    const ref = await renderTree(<GtkMultiSelection model={tree} />, { isExpanderHidden });
    const selection = ref.current?.getModel();

    if (!(selection instanceof Gtk.MultiSelection)) {
        throw new TypeError("The list view has no multi selection model");
    }

    return { tree, expander: await findBoundExpander(rootName), selection };
};

const expectCollapsed = ({ tree, expander }: TreeFixture): void => {
    expect(expander.getListRow()?.getExpanded()).toBe(false);
    expect(tree.getNItems()).toBe(ROOT_NAMES.length);
};

beforeEach(resetTree);

describe("clicking a tree expander", () => {
    it("expands the row behind it and leaves the enclosing row unselected", async () => {
        const { tree, expander, selection } = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.click(expander);
        expect(expander.getListRow()?.getExpanded()).toBe(true);
        expect(tree.getNItems()).toBe(ROOT_NAMES.length + CHILD_NAMES.length);
        expect(selection.getSelection().getSize()).toBe(0n);
    });

    it("collapses the row again on a second click", async () => {
        const fixture = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.click(fixture.expander);
        await userEvent.click(fixture.expander);
        expectCollapsed(fixture);
    });

    it("toggles twice on a double click, ending collapsed", async () => {
        const fixture = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.dblClick(fixture.expander);
        expectCollapsed(fixture);
    });

    it.each([
        ["a click", (expander: Gtk.TreeExpander): Promise<void> => userEvent.click(expander)],
        ["a pointer click token", (expander: Gtk.TreeExpander): Promise<void> => userEvent.pointer(expander, "click")],
    ])("fires a click gesture the expander itself carries on %s", async (_name, deliver) => {
        const fixture = await renderFixture(EXPANDABLE_ROOT);
        const counts = attachClickGesture(fixture.expander);
        await deliver(fixture.expander);
        expect(counts).toEqual({ pressed: 1, released: 1 });
        expect(fixture.expander.getListRow()?.getExpanded()).toBe(true);
    });

    it("selects the enclosing row instead when the expander's child label is clicked", async () => {
        const { expander, selection } = await renderFixture(EXPANDABLE_ROOT);
        await userEvent.click(screen.getByText(EXPANDABLE_ROOT));
        expect(expander.getListRow()?.getExpanded()).toBe(false);
        expect(selection.isSelected(0)).toBe(true);
    });

    it("selects the enclosing row when the expander has no children", async () => {
        const fixture = await renderFixture(LEAF_ROOT);
        await userEvent.click(fixture.expander);
        expectCollapsed(fixture);
        expect(fixture.selection.isSelected(1)).toBe(true);
    });

    it("selects the enclosing row when the expander is hidden", async () => {
        const fixture = await renderFixture(EXPANDABLE_ROOT, true);
        await userEvent.click(fixture.expander);
        expectCollapsed(fixture);
        expect(fixture.selection.isSelected(0)).toBe(true);
    });
});
