import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkListView, GtkNoSelection } from "@gtkx/jsx/gtk";
import { act, render, waitFor } from "@gtkx/testing";
import { useLayoutEffect, useState } from "react";
import { describe, expect, it } from "vitest";

type ProbeProps = {
    tree: Gtk.TreeListModel;
    log: string[];
    isArmed: boolean;
};

const ROOT_NAMES = ["first", "second"];

const childModelFor = (item: GObject.Object): Gtk.StringList | null => {
    if (item instanceof Gtk.StringObject && ROOT_NAMES.includes(item.getString())) {
        return Gtk.StringList.new([`${item.getString()}-child`]);
    }

    return null;
};

const newSiblingTree = (): Gtk.TreeListModel =>
    Gtk.TreeListModel.new(Gtk.StringList.new(ROOT_NAMES), false, false, childModelFor);

const expandLastRoot = (tree: Gtk.TreeListModel): void => {
    for (let position = tree.getNItems() - 1; position >= 0; position -= 1) {
        const row = tree.getRow(position);

        if (row !== null && row.getDepth() === 0) {
            row.setExpanded(true);

            return;
        }
    }
};

const Probe = ({ tree, log, isArmed }: ProbeProps) => {
    const [report, setReport] = useState<object | null>(null);

    useLayoutEffect(() => {
        if (report === null) {
            return;
        }

        log.push("commit");
        expandLastRoot(tree);
    }, [tree, log, report]);

    const handleItemsChanged = (position: number): void => {
        log.push(`items-changed(${String(position)})`);
        setReport({});
    };

    const selection = <GtkNoSelection model={tree} onItemsChanged={isArmed ? handleItemsChanged : undefined} />;

    return <GtkListView model={selection} />;
};

describe("reentrant signal commits", () => {
    it("commits a handler's update only after the emitting model's items-changed unwinds", async () => {
        const tree = newSiblingTree();
        const log: string[] = [];
        const { rerender } = await render(<Probe tree={tree} log={log} isArmed={false} />);
        await rerender(<Probe tree={tree} log={log} isArmed />);

        await act(() => {
            tree.getRow(0)?.setExpanded(true);
            log.push("unwound");
        });

        await waitFor(() => {
            expect(tree.getNItems()).toBe(4);
        });

        expect(log).toEqual(["items-changed(1)", "unwound", "commit", "items-changed(3)", "commit"]);
        expect(tree.getRow(0)?.getExpanded()).toBe(true);
        expect(tree.getRow(2)?.getExpanded()).toBe(true);
    });
});
