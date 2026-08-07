import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkEntry, GtkLabel, GtkSwitch } from "@gtkx/jsx/gtk";
import { render } from "@gtkx/testing";
import { createRef, type RefObject, useState } from "react";
import { describe, expect, it } from "vitest";

const accessible = (current: Gtk.Accessible | null): Gtk.Accessible => {
    if (!current) {
        throw new Error("Expected rendered widget");
    }

    return current;
};

const hasAccessibleProperty = (ref: RefObject<Gtk.Accessible | null>, property: Gtk.AccessibleProperty): boolean =>
    Gtk.testAccessibleHasProperty(accessible(ref.current), property);

const hasAccessibleState = (ref: RefObject<Gtk.Accessible | null>, state: Gtk.AccessibleState): boolean =>
    Gtk.testAccessibleHasState(accessible(ref.current), state);

describe("accessible props - states GTK collects as boolean or undefined", () => {
    it("renders accessibleExpanded, accessibleSelected and accessibleVisited without an FFI error", async () => {
        const ref = createRef<Gtk.Label>();
        await render(<GtkLabel ref={ref} accessibleExpanded accessibleSelected accessibleVisited />);
        expect(hasAccessibleState(ref, Gtk.AccessibleState.EXPANDED)).toBe(true);
        expect(hasAccessibleState(ref, Gtk.AccessibleState.SELECTED)).toBe(true);
        expect(hasAccessibleState(ref, Gtk.AccessibleState.VISITED)).toBe(true);
    });
});

describe("accessible props - GValue marshaling regression (1)", () => {
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
        expect(Gtk.testAccessibleHasState(accessible(ref.current), Gtk.AccessibleState.INVALID)).toBe(true);
    });
});

describe("accessible props - GValue marshaling regression (2)", () => {
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

        expect(Gtk.testAccessibleHasRelation(accessible(entryRef.current), Gtk.AccessibleRelation.LABELLED_BY)).toBe(
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
});

describe("accessible props - GValue marshaling regression (3)", () => {
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
