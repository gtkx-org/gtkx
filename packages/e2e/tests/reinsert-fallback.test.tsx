import type * as Gtk from "@gtkx/gi/gtk";
import * as Adw from "@gtkx/gi/adw";
import { AdwPreferencesGroup, AdwSwitchRow } from "@gtkx/jsx/adw";
import { renderChildren } from "@gtkx/testing/internal";
import { createRef, type RefObject } from "react";
import { describe, expect, it } from "vitest";

function* walk(widget: Gtk.Widget): IterableIterator<Gtk.Widget> {
    let child = widget.getFirstChild();

    while (child) {
        yield child;
        yield* walk(child);
        child = child.getNextSibling();
    }
}

const getRowTitles = (ref: RefObject<Adw.PreferencesGroup | null>): string[] => {
    const group = ref.current;

    if (group === null) {
        throw new Error("expected the preferences group ref to be assigned");
    }

    const titles: string[] = [];

    for (const widget of walk(group)) {
        if (widget instanceof Adw.PreferencesRow) {
            titles.push(widget.getTitle());
        }
    }

    return titles;
};

const buildGroup = (ref: RefObject<Adw.PreferencesGroup | null>) => (items: string[]) => (
    <AdwPreferencesGroup ref={ref}>
        {items.map((title) => (
            <AdwSwitchRow key={title} title={title} />
        ))}
    </AdwPreferencesGroup>
);

const expectRebuiltTitles = async (initial: string[], rebuilt: string[]): Promise<void> => {
    const ref = createRef<Adw.PreferencesGroup>();
    const { rerender } = await renderChildren(initial, buildGroup(ref));
    await rerender(rebuilt);
    expect(getRowTitles(ref)).toEqual(rebuilt);
};

describe("reinsert fallback - add/remove container without insert", () => {
    it("removes a middle row", async () => {
        await expectRebuiltTitles(["A", "B", "C"], ["A", "C"]);
    });

    it("inserts a row in the middle via full rebuild", async () => {
        await expectRebuiltTitles(["A", "B", "C"], ["A", "X", "B", "C"]);
    });

    it("reverses row order via full rebuild", async () => {
        await expectRebuiltTitles(["A", "B", "C"], ["C", "B", "A"]);
    });

    it("removes and reorders together via full rebuild", async () => {
        await expectRebuiltTitles(["A", "B", "C", "D"], ["D", "A", "C"]);
    });
});
