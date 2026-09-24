import type { ReactNode } from "react";
import { ParamFlags, paramSpecString } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkAspectFrame, GtkFrame, GtkLabel } from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react";
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

    it("rejects an element whose GType has not been registered", async () => {
        const UnknownElement = createElementComponent("GtkxUnregisteredCustomElement");

        await expect(render(<UnknownElement />)).rejects.toThrow();
    });
});

declare module "@gtkx/jsx/gtk" {
    /* eslint-disable @typescript-eslint/consistent-type-definitions -- declaration merging requires interfaces */
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }

    interface GtkFrameProps {
        labelSlot?: ReactNode;
        customTooltip?: string | null | undefined;
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
        await rerender(<GtkLabel ref={labelRef} />);
        expect(labelRef.current?.getCursor()).toBeNull();
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

it("renders, updates and unmounts a consumer element with merged behavior definitions", async () => {
    const frameRef = createRef<Gtk.Frame>();
    const labelRef = createRef<Gtk.Label>();
    const contentRef = createRef<Gtk.Label>();
    const App = ({ caption }: { caption: string | undefined }) => (
        <GtkFrame
            ref={frameRef}
            customTooltip={caption}
            labelSlot={<GtkLabel ref={labelRef}>Section</GtkLabel>}
        >
            <GtkLabel ref={contentRef}>Content</GtkLabel>
        </GtkFrame>
    );
    const { rerender, unmount } = await render(<App caption="Before" />);
    const frame = frameRef.current;
    expect(frame?.getTooltipText()).toBe("Before");
    expect(frame?.getChild()).toBe(contentRef.current);

    await rerender(<App caption="After" />);
    expect(frameRef.current).toBe(frame);
    expect(frame?.getTooltipText()).toBe("After");
    await rerender(<App caption={undefined} />);
    expect(frame?.getTooltipText()).toBeNull();

    await unmount();
    expect(frameRef.current).toBeNull();
    expect(labelRef.current).toBeNull();
    expect(contentRef.current).toBeNull();
    expect(frame?.getChild()).toBeNull();
    expect(frame?.getLabelWidget()).toBeNull();
});
