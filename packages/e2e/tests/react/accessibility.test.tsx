import type * as GObject from "@gtkx/gi/gobject";
import type { ReactNode, RefObject } from "react";
import * as Adw from "@gtkx/gi/adw";
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
    GtkStringList,
    GtkSwitch,
    GtkTextView,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { getWidgetText, render, screen, waitFor } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";
import { ItemFactory } from "../helpers/list-view-render.js";
import { gcUntil } from "../helpers/native-utils.js";

type AccessibleProbeProps = { show: boolean; ariaRef: RefObject<Gtk.Label | null> };

const AccessibleProbe = ({ show, ariaRef }: AccessibleProbeProps): ReactNode => (
    <GtkBox>{show ? <GtkLabel ref={ariaRef} label="watched" accessibleLabel="a11y" /> : null}</GtkBox>
);

const expectLabelSelection = async (text: string, range: [number, number], expected: string): Promise<void> => {
    const ref = createRef<Gtk.Label>();
    await render(<GtkLabel ref={ref} label={text} selectable />);
    const label = ref.current as Gtk.Label;
    label.selectRegion(range[0], range[1]);
    expect(label).toHaveSelection(expected);
};

const renderItemLabel = (item: GObject.Object): ReactNode => (
    item instanceof Gtk.StringObject ? <GtkLabel>{`Language: ${item.getString()}`}</GtkLabel> : null
);

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
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "Written by React");
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

        expect(set.current).toHaveAccessibleState(Gtk.AccessibleState.BUSY, true);
        expect(unset.current).not.toHaveAccessibleState(Gtk.AccessibleState.BUSY);
    });

    it("reads a tristate state as its enum member", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleChecked={Gtk.AccessibleTristate.MIXED} />);

        expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.CHECKED, Gtk.AccessibleTristate.MIXED);
    });
});

describe("holding accessible props against GTK's own writes", () => {
    it("holds accessibleHidden through the initial map", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleHidden />);

        await waitFor(() => {
            expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.HIDDEN, true);
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
            expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.HIDDEN, true);
        });
    });

    it("tracks an accessible prop added after the widget is mapped", async () => {
        const ref = createRef<Gtk.Label>();

        function App({ isAuthored, isHidden, isShown }: { isAuthored: boolean; isHidden: boolean; isShown: boolean }) {
            const accessible = isAuthored ? { accessibleHidden: isHidden } : {};

            return <GtkBox visible={isShown}><GtkLabel ref={ref} {...accessible} /></GtkBox>;
        }

        const { rerender } = await render(<App isAuthored={false} isHidden={false} isShown />);
        await rerender(<App isAuthored isHidden isShown />);
        await rerender(<App isAuthored isHidden={false} isShown={false} />);
        await rerender(<App isAuthored isHidden={false} isShown />);

        await waitFor(() => {
            expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.HIDDEN, false);
        });

        await rerender(<App isAuthored={false} isHidden={false} isShown={false} />);
        await rerender(<App isAuthored={false} isHidden={false} isShown />);

        await waitFor(() => {
            expect(ref.current).not.toHaveAccessibleState(Gtk.AccessibleState.HIDDEN, true);
        });
    });
});

describe("accessible names from label relations", () => {
    it("names a button from its label", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} label="Press me" />);
        expect(ref.current).toHaveAccessibleName("Press me");
    });

    it("combines every label in a labelled-by relation", async () => {
        const first = createRef<Gtk.Label>();
        const second = createRef<Gtk.Label>();
        const subject = createRef<Gtk.Box>();

        function App({ labels }: { labels: Gtk.Label[] }) {
            return (
                <GtkBox>
                    <GtkLabel ref={first}>First</GtkLabel>
                    <GtkLabel ref={second}>Second</GtkLabel>
                    <GtkBox ref={subject} accessibleRole={Gtk.AccessibleRole.GROUP} accessibleLabelledBy={labels} />
                </GtkBox>
            );
        }

        const { rerender } = await render(<App labels={[]} />);
        const firstLabel = first.current;
        const secondLabel = second.current;
        if (firstLabel === null || secondLabel === null) {
            throw new Error("The relation labels must be mounted");
        }
        await rerender(<App labels={[firstLabel, secondLabel]} />);
        expect(subject.current).toHaveAccessibleName("First Second");
    });
});

describe("accessible props - states GTK collects as boolean or undefined", () => {
    it("publishes expanded, selected and visited states", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleExpanded accessibleSelected accessibleVisited />);
        expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
        expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.VISITED, true);
    });
});

describe("accessible props - GValue marshaling regression", () => {
    it("publishes an authored accessible label", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} accessibleLabel="Zoom in" />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "Zoom in");
    });

    it("publishes an authored popup state", async () => {
        const ref = createRef<Gtk.Button>();
        await render(<GtkButton ref={ref} accessibleHasPopup />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.HAS_POPUP, true);
    });

    it("publishes authored keyboard shortcuts", async () => {
        const ref = createRef<Gtk.Switch>();
        await render(<GtkSwitch ref={ref} accessibleKeyShortcuts="Control+M" />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.KEY_SHORTCUTS, "Control+M");
    });

    it("publishes an authored invalid state", async () => {
        const ref = createRef<Gtk.Entry>();
        await render(<GtkEntry ref={ref} accessibleInvalid={Gtk.AccessibleInvalidState.TRUE} />);
        expect(ref.current).toHaveAccessibleState(Gtk.AccessibleState.INVALID, Gtk.AccessibleInvalidState.TRUE);
    });

    it("names an entry from its referenced label", async () => {
        const entryRef = createRef<Gtk.Entry>();

        function App() {
            const [label, setLabel] = useState<Gtk.Label | null>(null);

            return (
                <GtkBox>
                    <GtkLabel ref={setLabel}>Description</GtkLabel>
                    <GtkEntry ref={entryRef} accessibleLabelledBy={label ? [label] : undefined} />
                </GtkBox>
            );
        }

        await render(<App />);

        expect(entryRef.current).toHaveAccessibleName("Description");
    });

    it("updates an authored accessible label across renders", async () => {
        const ref = createRef<Gtk.Button>();

        function App({ label }: { label: string }) {
            return <GtkButton ref={ref} accessibleLabel={label} />;
        }

        const { rerender } = await render(<App label="First" />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "First");
        await rerender(<App label="Second" />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "Second");
        await rerender(<App label="Third" />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "Third");
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

        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "Zoom in");
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.HAS_POPUP, true);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.DESCRIPTION, "Increase font size");
    });

    it("clears an accessible prop when set to undefined", async () => {
        const ref = createRef<Gtk.Button>();

        function App({ label }: { label: string | undefined }) {
            return <GtkButton ref={ref} accessibleLabel={label} />;
        }

        const { rerender } = await render(<App label="With label" />);
        expect(ref.current).toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL, "With label");
        await rerender(<App label={undefined} />);
        expect(ref.current).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.LABEL);
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
                factory={<ItemFactory renderItem={renderItemLabel} />}
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
