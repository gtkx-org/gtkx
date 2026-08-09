import type * as Adw from "@gtkx/gi/adw";
import type * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwComboRow, AdwPreferencesGroup } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkBox,
    GtkDropDown,
    GtkEntry,
    GtkInscription,
    GtkLabel,
    GtkProgressBar,
    GtkScale,
    GtkScrollbar,
    GtkSignalListItemFactory,
    GtkStringList,
    GtkTextView,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { render, screen } from "@gtkx/testing";
import { createRef } from "react";
import { describe, expect, it } from "vitest";

const expectLabelSelection = async (text: string, range: [number, number], expected: string): Promise<void> => {
    const ref = createRef<Gtk.Label>();
    await render(<GtkLabel ref={ref} label={text} selectable />);
    const label = ref.current as Gtk.Label;
    label.selectRegion(range[0], range[1]);
    expect(label).toHaveSelection(expected);
};

const setUpItemLabel = (object: GObject.Object): void => {
    if (object instanceof Gtk.ListItem) {
        object.setChild(new Gtk.Label());
    }
};

const bindItemLabel = (object: GObject.Object): void => {
    const child = object instanceof Gtk.ListItem ? object.getChild() : null;
    const item = object instanceof Gtk.ListItem ? object.getItem() : null;

    if (child instanceof Gtk.Label && item instanceof Gtk.StringObject) {
        child.setLabel(`Language: ${item.getString()}`);
    }
};

const renderPlaceholderEntry = async (rendered: string, accessible: string): Promise<Gtk.Entry | null> => {
    const ref = createRef<Gtk.Entry>();
    await render(<GtkEntry ref={ref} placeholderText={rendered} accessiblePlaceholder={accessible} />);

    return ref.current;
};

describe("accessible reads beyond the concrete classes", () => {
    it("reads a placeholder from a widget that is not a Gtk.Editable", async () => {
        const ref = createRef<Gtk.TextView>();
        await render(<GtkTextView ref={ref} accessiblePlaceholder="type here" />);
        expect(screen.getByPlaceholderText("type here")).toBe(ref.current);
    });

    it("reads the selection of a selectable label", async () => {
        await expectLabelSelection("hello world", [6, 11], "world");
    });

    it("slices a label selection by code point", async () => {
        await expectLabelSelection("a😀bc", [1, 3], "😀b");
    });

    it("reads the shown option of an Adwaita combo row", async () => {
        const ref = createRef<Adw.ComboRow>();

        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <AdwPreferencesGroup>
                    <AdwComboRow ref={ref} title="Pick" model={<GtkStringList strings={["alpha", "beta"]} />} />
                </AdwPreferencesGroup>
            </GtkBox>,
        );

        expect(screen.getByDisplayValue("alpha")).toBeDefined();
    });

    it("reads the face a drop-down renders rather than the item behind it", async () => {
        const ref = createRef<Gtk.DropDown>();

        await render(
            <GtkDropDown
                ref={ref}
                model={<GtkStringList strings={["English", "French"]} />}
                factory={<GtkSignalListItemFactory onSetup={setUpItemLabel} onBind={bindItemLabel} />}
            />,
        );

        expect(screen.getByDisplayValue("Language: English")).toBe(ref.current);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_TEXT, "English");
    });
});

describe("indeterminate states match neither boolean", () => {
    it("does not match a mixed pressed toggle as pressed or unpressed", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkToggleButton label="Mixed" accessiblePressed={Gtk.AccessibleTristate.MIXED} />
            </GtkBox>,
        );

        expect(screen.queryAllByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: false })).toHaveLength(0);
        expect(screen.queryAllByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true })).toHaveLength(0);
    });
});

describe("numeric values compare within the resolution GTK publishes", () => {
    it("matches a scale value beyond six significant digits in every matcher alike", async () => {
        const ref = createRef<Gtk.Scale>();

        await render(
            <GtkScale ref={ref} adjustment={<GtkAdjustment value={1234.5678} lower={0} upper={10_000} />} />,
        );

        expect(screen.getByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 1234.5678 } })).toBe(ref.current);
        expect(screen.queryAllByRole(Gtk.AccessibleRole.SLIDER, { value: { now: 1234.57 } })).toHaveLength(0);
        expect(ref.current).toHaveValue(1234.5678);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 1234.5678);
        expect(ref.current).not.toHaveValue(1234.57);
        expect(ref.current).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 1234.57);
    });

    it("matches a progress fraction that six digits cannot represent", async () => {
        const ref = createRef<Gtk.ProgressBar>();
        await render(<GtkProgressBar ref={ref} fraction={1 / 3} />);
        expect(ref.current).toHaveValue(1 / 3);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 1 / 3);
    });
});

describe("numeric values carry the staleness GTK publishes them with", () => {
    it("still matches a value GTK held back because it moved by less than 0.001", async () => {
        const ref = createRef<Gtk.Scale>();
        const adjustment = createRef<Gtk.Adjustment>();

        await render(
            <GtkScale
                ref={ref}
                adjustment={<GtkAdjustment ref={adjustment} value={42} lower={0} upper={100} />}
            />,
        );

        adjustment.current?.setValue(42.0009);
        expect(adjustment.current?.getValue()).toBeCloseTo(42.0009, 8);
        expect(ref.current).toHaveValue(42.0009);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 42.0009);
        expect(ref.current).not.toHaveValue(42.0011);
        expect(ref.current).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 42.0011);
    });

    it("reports a scrollbar's maximum as the last value it can reach", async () => {
        const ref = createRef<Gtk.Scrollbar>();

        await render(
            <GtkScrollbar
                ref={ref}
                adjustment={<GtkAdjustment value={0} lower={0} upper={100} pageSize={10} />}
            />,
        );

        expect(screen.getByRole(Gtk.AccessibleRole.SCROLLBAR, { value: { max: 90 } })).toBe(ref.current);
        expect(screen.queryAllByRole(Gtk.AccessibleRole.SCROLLBAR, { value: { max: 100 } })).toHaveLength(0);
    });
});

describe("placeholders read what the widget renders", () => {
    it("prefers the rendered placeholder over the accessible one", async () => {
        const entry = await renderPlaceholderEntry("Search", "Query");
        expect(screen.getByPlaceholderText("Search")).toBe(entry);
        expect(screen.queryAllByPlaceholderText("Query")).toHaveLength(0);
    });

    it("ignores an empty accessible placeholder", async () => {
        const entry = await renderPlaceholderEntry("Real", "");
        expect(screen.getByPlaceholderText("Real")).toBe(entry);
    });
});

describe("inscriptions stay discoverable by text", () => {
    it("finds one whose text came from the text prop, and one from markup", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkInscription text="glyph name" />
                <GtkInscription markup="<b>bold name</b>" />
            </GtkBox>,
        );

        expect(screen.getByText("glyph name", { as: Gtk.Inscription })).toBeDefined();
        expect(screen.getByText("bold name", { as: Gtk.Inscription })).toBeDefined();
    });
});
