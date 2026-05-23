import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkEntry, GtkLabel, GtkSwitch } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { createRef, useState } from "react";
import { describe, expect, it } from "vitest";

const accessible = (current: Gtk.Accessible | null): Gtk.Accessible => {
    if (!current) throw new Error("Expected rendered widget");
    return current;
};

describe("accessible props - GValue marshaling regression (1)", () => {
    it("sets accessibleLabel (string) without crashing", async () => {
        const ref = createRef<Gtk.Button>();

        await render(<GtkButton ref={ref} accessibleLabel="Zoom in" />);

        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.LABEL)).toBe(true);
    });

    it("sets accessibleHasPopup (boolean) without crashing", async () => {
        const ref = createRef<Gtk.Button>();

        await render(<GtkButton ref={ref} accessibleHasPopup />);

        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.HAS_POPUP)).toBe(true);
    });

    it("sets accessibleKeyShortcuts (string) without crashing", async () => {
        const ref = createRef<Gtk.Switch>();

        await render(<GtkSwitch ref={ref} accessibleKeyShortcuts="Control+M" />);

        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.KEY_SHORTCUTS)).toBe(true);
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
                    <GtkLabel ref={setLabel} label="Description" />
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

        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.LABEL)).toBe(true);
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

        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.LABEL)).toBe(true);
        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.HAS_POPUP)).toBe(true);
        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.DESCRIPTION)).toBe(true);
    });

    it("clears an accessible prop when set to undefined", async () => {
        const ref = createRef<Gtk.Button>();

        function App({ label }: { label: string | undefined }) {
            return <GtkButton ref={ref} accessibleLabel={label} />;
        }

        const { rerender } = await render(<App label="With label" />);
        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.LABEL)).toBe(true);

        await rerender(<App label={undefined} />);
        expect(Gtk.testAccessibleHasProperty(accessible(ref.current), Gtk.AccessibleProperty.LABEL)).toBe(false);
    });
});
