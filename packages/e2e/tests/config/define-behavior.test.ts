import * as Gtk from "@gtkx/gi/gtk";
import { defineBehavior, defineElements, mergeElementConfigs } from "@gtkx/react/config";
import { expect, it } from "vitest";

const attached: string[] = [];

const frameBehavior = defineBehavior<Gtk.Frame>({
    attach: (frame, child) => {
        attached.push(frame.getLabel() ?? "unlabelled");
        frame.setChild(child as Gtk.Widget);

        return child;
    },
    update: (frame, _prev, next) => {
        frame.setLabel(String(next.label));

        return ["label"];
    },
});

const placement = { slot: "child", index: 0, sibling: null, adopted: null, props: {}, context: undefined };

it("gives each hook the concrete class without a hand-written annotation", () => {
    const frame = new Gtk.Frame({ label: "outer" });
    const label = new Gtk.Label({ label: "child" });
    frameBehavior.attach?.(frame as never, label, placement);
    expect(attached).toEqual(["outer"]);
    expect(frame.getChild()).toBe(label);
});

it("applies props through the inferred update hook", () => {
    const frame = new Gtk.Frame({ label: "before" });
    expect(frameBehavior.update?.(frame as never, {}, { label: "after" }, undefined)).toEqual(["label"]);
    expect(frame.getLabel()).toBe("after");
});

it("slots into defineElements and survives merging", () => {
    const elements = defineElements({ GtkFrame: { behaviors: [frameBehavior], omittedProps: ["child"] } });
    const merged = mergeElementConfigs(elements);
    expect(merged.GtkFrame?.behaviors).toHaveLength(1);
    expect(merged.GtkFrame?.omittedProps).toEqual(["child"]);
});
