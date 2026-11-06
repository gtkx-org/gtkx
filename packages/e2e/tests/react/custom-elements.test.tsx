import type { ReactNode } from "react";
import { BindingFlags, getProperty, ParamFlags, paramSpecString, setProperty } from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkAspectFrame,
    type GtkEditableProps,
    GtkFrame,
    GtkLabel,
    type GtkWidgetProps,
} from "@gtkx/jsx/gtk";
import { createElementComponent } from "@gtkx/react";
import { callParent, registerClass } from "@gtkx/runtime";
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

class CaptionedBinBase extends Gtk.Widget {
    declare caption: string;
    declare label: Gtk.Label;

    override vfuncConstructed(): void {
        super.vfuncConstructed();
        this.label = new Gtk.Label();
        this.label.setParent(this);
        this.bindProperty("caption", this.label, "label", BindingFlags.SYNC_CREATE);
    }
}

const CaptionedBin = registerClass(CaptionedBinBase, {
    typeName: "GtkxCaptionedBin",
    properties: { caption: paramSpecString("caption", null, null, "none", ParamFlags.READWRITE) },
    classInit(klass: Gtk.WidgetClass) {
        klass.setLayoutManagerType(Gtk.BinLayout);
    },
});

type CaptionedBin = InstanceType<typeof CaptionedBin>;

const CaptionedBinElement = createElementComponent<GtkWidgetProps<CaptionedBin> & { caption?: string }>(
    "GtkxCaptionedBin",
    CaptionedBin,
);

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

    it("notifies a binding made in vfuncConstructed of the props it was created with", async () => {
        const ref = createRef<CaptionedBin>();
        const { rerender } = await render(<CaptionedBinElement ref={ref} caption="Forecast" />);
        expect(ref.current?.label.getLabel()).toBe("Forecast");

        await rerender(<CaptionedBinElement ref={ref} caption="Hourly" />);
        expect(ref.current?.label.getLabel()).toBe("Hourly");
    });

    it("rejects an element whose GType has not been registered", async () => {
        const UnknownElement = createElementComponent("GtkxUnregisteredCustomElement");

        await expect(render(<UnknownElement />)).rejects.toThrow();
    });
});

class DelegatingEntryBase extends Gtk.Widget implements Gtk.EditableImpl {
    declare private delegate: Gtk.Text | null;
    declare initDelegate: Gtk.Editable["initDelegate"];
    declare finishDelegate: Gtk.Editable["finishDelegate"];

    override vfuncConstructed(): void {
        super.vfuncConstructed();
        const text = new Gtk.Text();
        text.setParent(this);
        this.delegate = text;
        this.initDelegate();
    }

    vfuncGetDelegate(): Gtk.Editable | null {
        return this.delegate;
    }

    vfuncDispose(): void {
        if (this.delegate !== null) {
            this.finishDelegate();
            this.delegate.unparent();
            this.delegate = null;
        }

        callParent(DelegatingEntry, "vfuncDispose", this);
    }
}

const DelegatingEntry = registerClass(DelegatingEntryBase, {
    typeName: "GtkxDelegatingEntry",
    implements: [Gtk.Editable],
    classInit(klass: Gtk.WidgetClass) {
        klass.setLayoutManagerType(Gtk.BoxLayout);
    },
});

type DelegatingEntry = InstanceType<typeof DelegatingEntry>;

const DelegatingEntryElement = createElementComponent<
    GtkWidgetProps<DelegatingEntry> & GtkEditableProps<DelegatingEntry>
>("GtkxDelegatingEntry", DelegatingEntry);

const TextlessEditable = registerClass(
    class extends Gtk.Widget implements Gtk.EditableImpl {
        vfuncGetText(): string {
            return "fixed";
        }
    },
    { typeName: "GtkxTextlessEditable", implements: [Gtk.Editable] },
);

const AccessorEditable = registerClass(
    class extends Gtk.Widget {
        declare stored: string;

        get text(): string {
            return this.stored ?? "";
        }

        set text(value: string) {
            this.stored = value;
        }
    },
    { typeName: "GtkxAccessorEditable", implements: [Gtk.Editable] },
);

describe("a registered Gtk.Editable", () => {
    it("routes its editable props to the delegate it returns from vfuncGetDelegate", async () => {
        const ref = createRef<DelegatingEntry>();
        const App = ({ text }: { text: string }) => (
            <DelegatingEntryElement ref={ref} text={text} editable={false} widthChars={4} />
        );
        const { rerender } = await render(<App text="hello" />);
        const delegate = ref.current?.getDelegate();
        expect(delegate?.getText()).toBe("hello");
        expect(delegate?.getEditable()).toBe(false);
        expect(delegate?.getWidthChars()).toBe(4);

        await rerender(<App text="" />);
        expect(delegate?.getText()).toBe("");
        expect(ref.current?.text).toBe("");

        delegate?.setText("again");
        delegate?.setPosition(3);
        expect(ref.current?.text).toBe("again");
        expect(ref.current?.cursorPosition).toBe(3);
        expect(ref.current?.editable).toBe(false);
    });

    it("rejects a write to a property it reads through a slot it has no setter for", () => {
        const editable = new TextlessEditable();

        expect(() => {
            editable.text = "lost";
        }).toThrow();
        expect(editable.text).toBe("fixed");
    });

    it("reads and writes a slot-backed property through the class's own accessors", () => {
        const editable = new AccessorEditable();

        setProperty(editable, "text", "typed");
        expect(getProperty(editable, "text")).toBe("typed");
    });
});

declare module "@gtkx/jsx/gtk" {
    interface GtkWidgetProps {
        cursorName?: string | null | undefined;
    }

    interface GtkFrameProps {
        labelSlot?: ReactNode;
        customTooltip?: string | null | undefined;
    }
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

it("renders, updates and unmounts a consumer element with merged behavior definitions", async () => {
    const frameRef = createRef<Gtk.Frame>();
    const labelRef = createRef<Gtk.Label>();
    const contentRef = createRef<Gtk.Label>();
    const App = ({ caption }: { caption: string | undefined }) => (
        <GtkFrame ref={frameRef} customTooltip={caption} labelSlot={<GtkLabel ref={labelRef}>Section</GtkLabel>}>
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
