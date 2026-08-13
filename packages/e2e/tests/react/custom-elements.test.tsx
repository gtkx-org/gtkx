import type { ElementBehavior } from "@gtkx/react/config";
import type { ReactNode } from "react";
import { ParamFlags, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkAspectFrame, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import {
    createElementComponent,
    defineBehavior,
    defineElements,
    ELEMENTS,
    mergeElementConfigs,
} from "@gtkx/react/config";
import { registerClass } from "@gtkx/runtime";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import "@gtkx/jsx/adw";

type TaggedScaleProps = {
    name?: string;
    tag?: string;
    adjustment?: unknown;
};

const TaggedScaleElement = createElementComponent<TaggedScaleProps>("GtkxTaggedScale");
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

const ADW_CONTAINER_TYPES = [
    "AdwBin",
    "AdwToolbarView",
    "AdwNavigationSplitView",
    "AdwPreferencesPage",
    "AdwTabView",
    "AdwWrapBox",
];

const behaviorsFor = (type: string): ElementBehavior[] => ELEMENTS[type]?.behaviors ?? [];

const typesWithoutAttach = (types: string[]): string[] =>
    types.filter((type) => behaviorsFor(type).every((behavior) => behavior.attach === undefined));

const emptyBehaviorNames = (type: string, behaviors: ElementBehavior[]): string[] =>
    behaviors.flatMap((behavior, index) => (Object.keys(behavior).length === 0 ? [`${type}[${String(index)}]`] : []));

class TaggedScale extends Gtk.Scale {
    declare tag: string;
}

registerClass(TaggedScale, {
    typeName: "GtkxTaggedScale",
    properties: { tag: paramSpecString("tag", null, null, "none", ParamFlags.READWRITE) },
});

describe("createElementComponent for a type codegen does not cover", () => {
    it("renders a registered subclass with its own props", async () => {
        await render(<TaggedScaleElement name="tagged" tag="mine" />);
        const found = await screen.findByName("tagged");
        expect(found).toBeInstanceOf(TaggedScale);
        expect((found as TaggedScale).tag).toBe("mine");
    });

    it("routes an element-valued prop into its slot", async () => {
        await render(
            <TaggedScaleElement name="slotted" adjustment={<GtkAdjustment value={7} lower={0} upper={10} />} />,
        );

        const found = await screen.findByName("slotted");
        expect((found as Gtk.Scale).getAdjustment().getValue()).toBe(7);
    });
});

declare module "@gtkx/jsx/gtk" {
    /* eslint-disable @typescript-eslint/consistent-type-definitions -- declaration merging requires interfaces */
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }

    interface GtkFrameProps {
        labelSlot?: ReactNode;
    }
    /* eslint-enable @typescript-eslint/consistent-type-definitions */
}

describe("custom element rules from gtkx.config.ts", () => {
    it("applies a rule declared by the configured module", async () => {
        const labelRef = createRef<Gtk.Label>();
        await render(<GtkLabel ref={labelRef} cursorName="pointer" />);
        expect(labelRef.current?.getCursor()).toHaveObjectProperty("name", "pointer");
    });

    it("consults the app config before a built-in slot behavior", async () => {
        const frameRef = createRef<Gtk.AspectFrame>();

        await render(
            <GtkAspectFrame ref={frameRef}>
                <GtkLabel>child</GtkLabel>
            </GtkAspectFrame>,
        );

        expect(frameRef.current).toHaveClass("app-claimed-children");
    });

    it("reapplies the rule when the prop changes", async () => {
        const labelRef = createRef<Gtk.Label>();
        const { rerender } = await render(<GtkLabel ref={labelRef} cursorName="pointer" />);
        await rerender(<GtkLabel ref={labelRef} cursorName="text" />);
        expect(labelRef.current?.getCursor()).toHaveObjectProperty("name", "text");
    });

    it("places children through a declared container prop", async () => {
        const frameRef = createRef<Gtk.Frame>();
        await render(<GtkFrame ref={frameRef} labelSlot={<GtkLabel>Section</GtkLabel>} />);
        expect(await screen.findByText("Section")).toBe(frameRef.current?.getLabelWidget());
    });

    it("clears a declared container prop when its child unmounts", async () => {
        const frameRef = createRef<Gtk.Frame>();

        const App = ({ hasLabel }: { hasLabel: boolean }) => (
            <GtkFrame ref={frameRef} labelSlot={hasLabel ? <GtkLabel>Section</GtkLabel> : null} />
        );

        const { rerender } = await render(<App hasLabel={true} />);
        expect(frameRef.current?.getLabelWidget()).not.toBeNull();
        await rerender(<App hasLabel={false} />);
        expect(frameRef.current?.getLabelWidget()).toBeNull();
    });
});

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

describe("adwaita behavior registration", () => {
    it("registers Adwaita behaviors when @gtkx/jsx/adw is loaded", () => {
        expect(typesWithoutAttach(ADW_CONTAINER_TYPES)).toEqual([]);
    });

    it("gives every registered behavior at least one property", () => {
        const empty = Object.entries(ELEMENTS).flatMap(([type, config]) =>
            emptyBehaviorNames(type, config.behaviors ?? []),
        );

        expect(empty.toSorted((left, right) => left.localeCompare(right))).toEqual([]);
    });
});
