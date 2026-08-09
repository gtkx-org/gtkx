import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkEntry, GtkExpander, GtkLabel, GtkListBox, GtkListBoxRow, GtkToggleButton } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { render, screen } from "../src/index.js";
import { expectRejection, renderLabel, renderNamedBox } from "./widget-fixtures.js";

const renderToggle = async (pressed?: Gtk.AccessibleTristate): Promise<Gtk.ToggleButton> => {
    await render(<GtkToggleButton name="toggle" label="Bold" accessiblePressed={pressed} />);

    return screen.findByName("toggle", { as: Gtk.ToggleButton });
};

const expectValueNowRejection = (widget: Gtk.Widget, message: RegExp): void => {
    expectRejection(() => {
        expect(widget).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 5);
    }, message);
};

const renderExpander = async (): Promise<Gtk.Expander> => {
    await render(
        <GtkExpander name="expander" label="Details">
            <GtkLabel>Body</GtkLabel>
        </GtkExpander>,
    );

    return screen.findByName("expander", { as: Gtk.Expander });
};

describe("toHaveAccessibleState", () => {
    it("reads a plain boolean state", async () => {
        await render(<GtkBox name="loading" accessibleBusy={true} />);
        const box = await screen.findByName("loading");
        expect(box).toHaveAccessibleState(Gtk.AccessibleState.BUSY, true);
        expect(box).not.toHaveAccessibleState(Gtk.AccessibleState.BUSY, false);
    });

    it("reads the optional boolean expanded state GTK maintains", async () => {
        const expander = await renderExpander();
        expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
        expander.setExpanded(true);
        expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
    });

    it("reads the selected state of a list box row", async () => {
        await render(
            <GtkListBox selectionMode={Gtk.SelectionMode.SINGLE}>
                <GtkListBoxRow name="row">
                    <GtkLabel>Row</GtkLabel>
                </GtkListBoxRow>
            </GtkListBox>,
        );

        const row = await screen.findByName("row", { as: Gtk.ListBoxRow });
        expect(row).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
    });

    it("reads a tristate state", async () => {
        const toggle = await renderToggle(Gtk.AccessibleTristate.MIXED);
        expect(toggle).toHaveAccessibleState(Gtk.AccessibleState.PRESSED, Gtk.AccessibleTristate.MIXED);
        expect(toggle).not.toHaveAccessibleState(Gtk.AccessibleState.PRESSED, Gtk.AccessibleTristate.TRUE);
    });

    it("reads the invalid token state", async () => {
        await render(<GtkEntry name="field" accessibleInvalid={Gtk.AccessibleInvalidState.SPELLING} />);
        const entry = await screen.findByName("field");
        expect(entry).toHaveAccessibleState(Gtk.AccessibleState.INVALID, Gtk.AccessibleInvalidState.SPELLING);
        expect(entry).not.toHaveAccessibleState(Gtk.AccessibleState.INVALID, Gtk.AccessibleInvalidState.TRUE);
    });

    it("asserts only that the state is set when given no value", async () => {
        const toggle = await renderToggle(Gtk.AccessibleTristate.FALSE);
        expect(toggle).toHaveAccessibleState(Gtk.AccessibleState.PRESSED);
        expect(toggle).not.toHaveAccessibleState(Gtk.AccessibleState.BUSY);
    });

    it("fails rather than throws for a widget that declares nothing", async () => {
        const label = await renderLabel("Plain");
        expect(label).not.toHaveAccessibleState(Gtk.AccessibleState.EXPANDED);
        expect(label).not.toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
    });
});

describe("toHaveAccessibleProperty", () => {
    it("reads a string property", async () => {
        await render(<GtkBox name="described" accessibleRoleDescription="palette" />);
        const box = await screen.findByName("described");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.ROLE_DESCRIPTION, "palette");
        expect(box).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.ROLE_DESCRIPTION, "toolbar");
    });

    it("reads a boolean property", async () => {
        await render(<GtkBox name="popped" accessibleHasPopup={true} accessibleModal={false} />);
        const box = await screen.findByName("popped");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.HAS_POPUP, true);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.MODAL, false);
    });

    it("reads an integer and a double property", async () => {
        await render(<GtkBox name="ranked" accessibleLevel={3} accessibleValueNow={7.5} />);
        const box = await screen.findByName("ranked");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.LEVEL, 3);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 7.5);
    });

    it("reads the token properties without tripping GTK's range checks", async () => {
        await render(
            <GtkBox
                name="tokens"
                accessibleSort={Gtk.AccessibleSort.DESCENDING}
                accessibleOrientation={Gtk.Orientation.VERTICAL}
                accessibleAutocomplete={Gtk.AccessibleAutocomplete.INLINE}
            />,
        );

        const box = await screen.findByName("tokens");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.SORT, Gtk.AccessibleSort.DESCENDING);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.ORIENTATION, Gtk.Orientation.VERTICAL);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.AUTOCOMPLETE, Gtk.AccessibleAutocomplete.INLINE);
        expect(box).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.SORT, Gtk.AccessibleSort.ASCENDING);
    });

    it("asserts only that the property is set when given no value", async () => {
        await render(<GtkBox name="shortcut" accessibleKeyShortcuts="Control+N" />);
        const box = await screen.findByName("shortcut");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.KEY_SHORTCUTS);
        expect(box).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.ROLE_DESCRIPTION);
    });

    it("mentions rounding when a numeric reading misses the expected value", async () => {
        await render(<GtkBox name="ranked" accessibleValueNow={7.5} />);
        const box = await screen.findByName("ranked");
        expectValueNowRejection(box, /but received 7\.5, which the accessibility tree rounds/);
    });

    it("omits the rounding mention when the numeric property is unset", async () => {
        expectValueNowRejection(await renderNamedBox("plain"), /but received unset\n/);
    });
});

describe("toBePartiallyPressed", () => {
    it("passes for a toggle whose pressed state is mixed", async () => {
        expect(await renderToggle(Gtk.AccessibleTristate.MIXED)).toBePartiallyPressed();
    });

    it("fails for a toggle that is plainly pressed", async () => {
        expect(await renderToggle(Gtk.AccessibleTristate.TRUE)).not.toBePartiallyPressed();
    });

    it("throws for a widget that exposes no pressed state", async () => {
        const label = await renderLabel("Plain");

        expectRejection(() => {
            expect(label).toBePartiallyPressed();
        }, /does not expose a pressed state/);
    });
});
