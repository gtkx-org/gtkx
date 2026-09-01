import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
import * as GObject from "@gtkx/gi/gobject";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwActionRow, AdwComboRow, AdwPreferencesGroup, AdwPreferencesPage } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkDropDown,
    GtkEntry,
    GtkInscription,
    GtkLabel,
    GtkProgressBar,
    GtkScale,
    GtkScrollbar,
    GtkSignalListItemFactory,
    GtkStringList,
    GtkSwitch,
    GtkTextView,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { getWidgetText, render, screen, waitFor } from "@gtkx/testing";
import {
    readAccessibleFlag,
    readAccessibleRelation,
    readAccessibleState,
    readAccessibleString,
} from "@gtkx/testing/internal";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { gcUntil } from "../helpers/native-utils.js";

type AccessibleProbeProps = { show: boolean; ariaRef: RefObject<Gtk.Label | null> };

const AccessibleProbe = ({ show, ariaRef }: AccessibleProbeProps): ReactNode => (
    <GtkBox>{show ? <GtkLabel ref={ariaRef} label="watched" accessibleLabel="a11y" /> : null}</GtkBox>
);

const descendants = (widget: Gtk.Widget): Gtk.Accessible[] => {
    const found: Gtk.Accessible[] = [];
    let child = widget.getFirstChild();

    while (child) {
        found.push(child, ...descendants(child));
        child = child.getNextSibling();
    }

    return found;
};

const getAccessible = (current: Gtk.Accessible | null): Gtk.Accessible => {
    if (!current) {
        throw new Error("Expected rendered widget");
    }

    return current;
};

const hasAccessibleProperty = (ref: RefObject<Gtk.Accessible | null>, property: Gtk.AccessibleProperty): boolean =>
    Gtk.testAccessibleHasProperty(getAccessible(ref.current), property);

const hasAccessibleState = (ref: RefObject<Gtk.Accessible | null>, state: Gtk.AccessibleState): boolean =>
    Gtk.testAccessibleHasState(getAccessible(ref.current), state);

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

const renderRow = async (title: string, isUnderlineUsed: boolean): Promise<RefObject<Adw.ActionRow | null>> => {
    const ref = createRef<Adw.ActionRow>();

    await render(
        <AdwPreferencesPage>
            <AdwPreferencesGroup title="Server">
                <AdwActionRow ref={ref} title={title} useUnderline={isUnderlineUsed} />
            </AdwPreferencesGroup>
        </AdwPreferencesPage>,
    );

    return ref;
};

describe("reading accessible attributes from GTK", () => {
    it("reads a string property back verbatim", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleLabel="Written by React" />);
        expect(readAccessibleString(getAccessible(ref.current), Gtk.AccessibleProperty.LABEL)).toBe("Written by React");
    });

    it("reads a boolean state GTK does not maintain itself", async () => {
        const set = createRef<Gtk.Label>();
        const unset = createRef<Gtk.Label>();

        await render(
            <GtkBox>
                <GtkLabel ref={set} accessibleBusy />
                <GtkLabel ref={unset} />
            </GtkBox>,
        );

        expect(readAccessibleFlag(getAccessible(set.current), Gtk.AccessibleState.BUSY)).toBe(true);
        expect(readAccessibleFlag(getAccessible(unset.current), Gtk.AccessibleState.BUSY)).toBeNull();
    });

    it("reads a tristate state as its enum member", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleChecked={Gtk.AccessibleTristate.MIXED} />);

        expect(readAccessibleState(getAccessible(ref.current), Gtk.AccessibleState.CHECKED)).toBe(
            Gtk.AccessibleTristate.MIXED,
        );
    });
});

describe("holding accessible props against GTK's own writes", () => {
    it("holds accessibleHidden through the initial map", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleHidden />);

        await waitFor(() => {
            expect(readAccessibleFlag(getAccessible(ref.current), Gtk.AccessibleState.HIDDEN)).toBe(true);
        });
    });

    it("holds accessibleHidden across a hide and show cycle", async () => {
        const ref = createRef<Gtk.Label>();

        function App({ isShown }: { isShown: boolean }) {
            return <GtkBox visible={isShown}><GtkLabel ref={ref} accessibleHidden /></GtkBox>;
        }

        const { rerender } = await render(<App isShown />);
        await rerender(<App isShown={false} />);
        await rerender(<App isShown />);

        await waitFor(() => {
            expect(readAccessibleFlag(getAccessible(ref.current), Gtk.AccessibleState.HIDDEN)).toBe(true);
        });
    });
});

describe("resolving relation targets without reading the print string", () => {
    it("resolves the LABELLED_BY GTK writes on a button to its own label", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} label="Press me" />);
        const button = ref.current as Gtk.Widget;
        const targets = readAccessibleRelation(button, Gtk.AccessibleRelation.LABELLED_BY, descendants(button));
        expect(targets).toHaveLength(1);
        expect(targets[0]).toHaveTextContent("Press me");
    });

    it("resolves a relation carrying more than one target", async () => {
        const first = createRef<Gtk.Label>();
        const second = createRef<Gtk.Label>();
        const subject = createRef<Gtk.Box>();

        function App({ labels }: { labels: Gtk.Label[] }) {
            return (
                <GtkBox>
                    <GtkLabel ref={first}>First</GtkLabel>
                    <GtkLabel ref={second}>Second</GtkLabel>
                    <GtkBox ref={subject} accessibleLabelledBy={labels} />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App labels={[]} />);
        const both = [first.current as Gtk.Label, second.current as Gtk.Label];
        await rerender(<App labels={both} />);

        const resolved = readAccessibleRelation(
            subject.current as Gtk.Accessible,
            Gtk.AccessibleRelation.LABELLED_BY,
            both,
        );

        expect(resolved).toHaveLength(2);
        expect(resolved).toEqual(expect.arrayContaining(both));
    });
});

describe("accessible props - states GTK collects as boolean or undefined", () => {
    it("renders accessibleExpanded, accessibleSelected and accessibleVisited without an FFI error", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleExpanded accessibleSelected accessibleVisited />);
        expect(hasAccessibleState(ref, Gtk.AccessibleState.EXPANDED)).toBe(true);
        expect(hasAccessibleState(ref, Gtk.AccessibleState.SELECTED)).toBe(true);
        expect(hasAccessibleState(ref, Gtk.AccessibleState.VISITED)).toBe(true);
    });
});

describe("accessible props - GValue marshaling regression", () => {
    it("sets accessibleLabel (string) without crashing", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} accessibleLabel="Zoom in" />);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.LABEL)).toBe(true);
    });

    it("sets accessibleHasPopup (boolean) without crashing", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} accessibleHasPopup />);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.HAS_POPUP)).toBe(true);
    });

    it("sets accessibleKeyShortcuts (string) without crashing", async () => {
        const ref = createRef<Gtk.Switch>();
        await render(<GtkSwitch ref={ref} accessibleKeyShortcuts="Control+M" />);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.KEY_SHORTCUTS)).toBe(true);
    });

    it("sets accessibleInvalid (token) without crashing", async () => {
        const ref = createRef<Gtk.Entry>();
        await render(<GtkEntry ref={ref} accessibleInvalid={Gtk.AccessibleInvalidState.TRUE} />);
        expect(Gtk.testAccessibleHasState(getAccessible(ref.current), Gtk.AccessibleState.INVALID)).toBe(true);
    });

    it("sets accessibleLabelledBy (reference list) without crashing", async () => {
        const entryRef = createRef<Gtk.Entry>();

        function App() {
            const [label, setLabel] = useState<Gtk.Label | null>(null);

            return (
                <>
                    <GtkLabel ref={setLabel}>Description</GtkLabel>
                    <GtkEntry ref={entryRef} accessibleLabelledBy={label ? [label] : undefined} />
                </>
            );
        }

        await render(<App />);

        expect(Gtk.testAccessibleHasRelation(getAccessible(entryRef.current), Gtk.AccessibleRelation.LABELLED_BY)).toBe(
            true,
        );
    });

    it("updates a string accessible prop across renders without crashing", async () => {
        const ref = createRef<Gtk.Button>();

        function App({ label }: { label: string }) {
            return <GtkButton ref={ref} accessibleLabel={label} />;
        }

        const { rerender } = await render(<App label="First" />);
        await rerender(<App label="Second" />);
        await rerender(<App label="Third" />);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.LABEL)).toBe(true);
    });

    it("combines multiple accessible props on the same widget", async () => {
        const ref = createRef<Gtk.Button>();

        await render(
            <GtkButton
                ref={ref}
                accessibleLabel="Zoom in"
                accessibleHasPopup
                accessibleDescription="Increase font size"
            />,
        );

        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.LABEL)).toBe(true);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.HAS_POPUP)).toBe(true);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.DESCRIPTION)).toBe(true);
    });

    it("clears an accessible prop when set to undefined", async () => {
        const ref = createRef<Gtk.Button>();

        function App({ label }: { label: string | undefined }) {
            return <GtkButton ref={ref} accessibleLabel={label} />;
        }

        const { rerender } = await render(<App label="With label" />);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.LABEL)).toBe(true);
        await rerender(<App label={undefined} />);
        expect(hasAccessibleProperty(ref, Gtk.AccessibleProperty.LABEL)).toBe(false);
    });
});

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

        expect(screen.getByDisplayValue("alpha")).toBe(ref.current);
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

        expect(screen.getByText("glyph name", { as: Gtk.Inscription })).toHaveTextContent(/^glyph name$/);
        expect(screen.getByText("bold name", { as: Gtk.Inscription })).toHaveTextContent(/^bold name$/);
    });
});

describe("render - access keys", () => {
    it("drops the mnemonic marker from a preferences row title", async () => {
        await renderRow("_Host", true);
        expect(await screen.findByText("Host")).toHaveTextContent(/^Host$/);
    });

    it("keeps an underscore in a title that does not use an underline", async () => {
        await renderRow("_Host", false);
        expect(await screen.findByText("_Host")).toHaveTextContent(/^_Host$/);
    });

    it("reports the drawn title as the row's node text", async () => {
        const ref = await renderRow("_Database File", true);
        const row = ref.current;
        expect(row).not.toBeNull();
        expect(row === null ? null : getWidgetText(row)).toBe("Database File");
    });
});

describe("accessibility - lifetime", () => {
    it("frees an unmounted widget that carried accessible props", async () => {
        const ariaRef = createRef<Gtk.Label>();
        const { rerender } = await render(<AccessibleProbe show ariaRef={ariaRef} />);
        const weak = new WeakRef(ariaRef.current as object);
        ariaRef.current = null;
        await rerender(<AccessibleProbe show={false} ariaRef={ariaRef} />);
        await gcUntil(() => weak.deref() === undefined, 40);
        expect(weak.deref()).toBeUndefined();
    });
});
