import type { ExpanderDescriptions, ListItem, ListItemRenderArgs } from "@gtkx/components";
import type { ReactNode } from "react";
import { ListView } from "@gtkx/components";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkLabel } from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { ScrollWrapper } from "./helpers/scroll-wrapper.js";

type Named = { name: string };

const DESCRIPTIONS: ExpanderDescriptions = { expand: "Expand", collapse: "Collapse" };

const items: ListItem<Named>[] = [
    {
        id: "parent",
        value: { name: "Parent" },
        children: [{ id: "child", value: { name: "Child" }, shouldHideExpander: true }],
    },
    {
        id: "quiet",
        value: { name: "Quiet" },
        shouldHideExpander: true,
        children: [{ id: "kid", value: { name: "Kid" } }],
    },
    { id: "leaf", value: { name: "Leaf" } },
];

const renderItem = ({ item }: ListItemRenderArgs<Named>): ReactNode => <GtkLabel>{item.name}</GtkLabel>;

const expanderNamed = (name: string): Gtk.TreeExpander =>
    screen.getByRole(Gtk.AccessibleRole.BUTTON, { name, as: Gtk.TreeExpander });

const hasDescription = (expander: Gtk.TreeExpander): boolean =>
    Gtk.testAccessibleHasProperty(expander, Gtk.AccessibleProperty.DESCRIPTION);

const hasExpandedState = (expander: Gtk.TreeExpander): boolean =>
    Gtk.testAccessibleHasState(expander, Gtk.AccessibleState.EXPANDED);

const drawTree = (expandedIds: string[], descriptions: ExpanderDescriptions | undefined): ReactNode => (
    <ScrollWrapper>
        <ListView
            items={items}
            renderItem={renderItem}
            expandedIds={expandedIds}
            expanderDescriptions={descriptions}
        />
    </ScrollWrapper>
);

const drawDescribedTree = (expandedIds: string[]): ReactNode => drawTree(expandedIds, DESCRIPTIONS);
const drawPlainTree = (expandedIds: string[]): ReactNode => drawTree(expandedIds, undefined);

const expectNoDescription = (names: string[]): void => {
    for (const name of names) {
        expect(hasDescription(expanderNamed(name))).toBe(false);
    }
};

const expectDescriptionToTrackExpansion = async (name: string, id: string): Promise<void> => {
    const { rerender } = await render(drawDescribedTree([]));
    expect(expanderNamed(name)).toHaveAccessibleDescription("Expand");
    await rerender(drawDescribedTree([id]));
    expect(expanderNamed(name)).toHaveAccessibleDescription("Collapse");
};

describe("tree expander accessibility (1)", () => {
    it("keeps the row content as the expander's accessible name", async () => {
        await render(drawDescribedTree(["parent"]));
        expect(expanderNamed("Parent")).toHaveAccessibleName("Parent");
        expect(expanderNamed("Child")).toHaveAccessibleName("Child");
        expect(expanderNamed("Leaf")).toHaveAccessibleName("Leaf");
    });

    it("leaves the expanded state to GTK, which sets it wherever the row can expand", async () => {
        await render(drawDescribedTree(["parent"]));
        expect(hasExpandedState(expanderNamed("Parent"))).toBe(true);
        expect(expanderNamed("Parent")).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
        expect(hasExpandedState(expanderNamed("Quiet"))).toBe(true);
        expect(hasExpandedState(expanderNamed("Child"))).toBe(false);
        expect(hasExpandedState(expanderNamed("Leaf"))).toBe(false);
    });
});

describe("tree expander accessibility (2)", () => {
    it("describes what activating an expandable row's expander does", async () => {
        await expectDescriptionToTrackExpansion("Parent", "parent");
    });

    it("describes a row whose expander is hidden but which GTK still expands", async () => {
        await expectDescriptionToTrackExpansion("Quiet", "quiet");
    });

    it("describes nothing on an expander GTK cannot expand", async () => {
        await render(drawDescribedTree(["parent"]));
        expectNoDescription(["Child", "Leaf"]);
    });
});

describe("tree expander accessibility (3)", () => {
    it("describes nothing at all when no wording is given", async () => {
        await render(drawPlainTree(["parent"]));
        expectNoDescription(["Parent", "Quiet", "Child", "Leaf"]);
    });

    it("drops the description once the wording is taken away", async () => {
        const { rerender } = await render(drawDescribedTree(["parent"]));
        expect(expanderNamed("Parent")).toHaveAccessibleDescription("Collapse");
        await rerender(drawPlainTree(["parent"]));
        expectNoDescription(["Parent", "Quiet", "Child", "Leaf"]);
    });
});
