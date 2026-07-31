import * as Gtk from "@gtkx/gi/gtk";
import { GtkAdjustment, GtkBox, GtkButton, GtkCheckButton, GtkEntry, GtkLabel, GtkScale } from "@gtkx/jsx/gtk";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { render, screen } from "../src/index.js";
import {
    expectRejection,
    renderButton,
    renderEntry,
    renderLabel,
    renderNamedBox,
    renderSlider,
    renderStyledButton,
} from "./widget-fixtures.js";

function InvalidField() {
    const [reason, setReason] = useState<Gtk.Label | null>(null);

    return (
        <GtkBox>
            <GtkLabel ref={setReason}>Name is required</GtkLabel>
            <GtkEntry
                name="field"
                accessibleInvalid={Gtk.AccessibleInvalidState.TRUE}
                accessibleErrorMessage={reason ? [reason] : undefined}
            />
        </GtkBox>
    );
}

function assertNumericValue(widget: Gtk.Widget): void {
    expect(widget).toHaveValue(1);
}

function assertDisplayValue(widget: Gtk.Widget): void {
    expect(widget).toHaveDisplayValue("x");
}

describe("sensitivity, visibility and rooting matchers", () => {
    it("toBeDisabled and toBeEnabled read sensitivity", async () => {
        await render(<GtkButton label="Save" sensitive={false} />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(button).toBeDisabled();
        expect(button).not.toBeEnabled();
    });

    it("toBeEnabled is the inverse for a sensitive widget", async () => {
        const button = await renderButton("Save");
        expect(button).toBeEnabled();
        expect(button).not.toBeDisabled();
    });

    it("toBeVisible reads a rendered widget's visibility", async () => {
        expect(await renderLabel("Shown")).toBeVisible();
    });

    it("toBeVisible fails for a widget hidden by a zero-opacity ancestor", async () => {
        await render(
            <GtkBox opacity={0}>
                <GtkLabel>Faded</GtkLabel>
            </GtkBox>,
        );

        const label = await screen.findByText("Faded");
        expect(label).not.toBeVisible();
    });

    it("toBeRooted passes for a rendered widget", async () => {
        expect(await renderLabel("Rooted")).toBeRooted();
    });

    it("toBeRooted fails for a widget that was never added to a window", () => {
        expect(new Gtk.Label({ label: "Detached" })).not.toBeRooted();
    });

    it("toBeRooted fails for null without throwing", () => {
        expect(null).not.toBeRooted();
    });
});

describe("emptiness, validity and focus matchers", () => {
    it("toBeEmpty passes for a container with no children", async () => {
        expect(await renderNamedBox("empty-box")).toBeEmpty();
    });

    it("toBeEmpty fails for a label carrying text", async () => {
        expect(await renderLabel("Filled")).not.toBeEmpty();
    });

    it("toBeInvalid and toBeValid read the accessible invalid state", async () => {
        await render(<GtkEntry name="bad" accessibleInvalid={Gtk.AccessibleInvalidState.TRUE} />);
        const entry = await screen.findByName("bad");
        expect(entry).toBeInvalid();
        expect(entry).not.toBeValid();
    });

    it("toBeValid passes for a widget with no invalid state", async () => {
        const entry = await renderEntry("good");
        expect(entry).toBeValid();
        expect(entry).not.toBeInvalid();
    });

    it("toHaveFocus reflects the focused widget", async () => {
        const entry = await renderEntry("focused");
        entry.grabFocus();
        expect(entry).toHaveFocus();
    });
});

describe("role and containment matchers", () => {
    it("toHaveRole compares the accessible role", async () => {
        const button = await renderButton("Press");
        expect(button).toHaveRole(Gtk.AccessibleRole.BUTTON);
        expect(button).not.toHaveRole(Gtk.AccessibleRole.CHECKBOX);
    });

    it("toContainElement finds a descendant", async () => {
        await render(
            <GtkBox name="outer">
                <GtkLabel>Inside</GtkLabel>
            </GtkBox>,
        );

        const box = await screen.findByName("outer");
        const label = await screen.findByText("Inside");
        expect(box).toContainElement(label);
    });

    it("toContainElement treats a widget as containing itself", async () => {
        const label = await renderLabel("Self");
        expect(label).toContainElement(label);
    });

    it("toContainElement fails for null", async () => {
        expect(await renderNamedBox("lonely")).not.toContainElement(null);
    });
});

describe("toHaveClass", () => {
    it("matches a single style class", async () => {
        expect(await renderStyledButton(["suggested-action", "pill"])).toHaveClass("pill");
    });

    it("matches a whitespace separated list", async () => {
        expect(await renderStyledButton(["suggested-action", "pill"])).toHaveClass("pill suggested-action");
    });

    it("matches a regular expression", async () => {
        expect(await renderStyledButton(["suggested-action"])).toHaveClass(/^suggested/);
    });

    it("asserts that any class is present when given none", async () => {
        expect(await renderStyledButton(["pill"])).toHaveClass();
    });

    it("requires the whole set with the exact option", async () => {
        const button = await renderStyledButton(["suggested-action", "pill"]);
        expect(button).toHaveClass("pill", "suggested-action", { exact: true });
        expect(button).not.toHaveClass("pill", { exact: true });
    });

    it("rejects a regular expression combined with the exact option", async () => {
        const button = await renderStyledButton(["pill"]);

        expectRejection(() => {
            expect(button).toHaveClass(/pill/, { exact: true });
        }, /cannot be combined with a regular expression/);
    });
});

describe("toHaveObjectProperty", () => {
    it("reads a property by name", async () => {
        const slider = await renderSlider(42, 100);
        expect(slider.getAdjustment()).toHaveObjectProperty("upper", 100);
    });

    it("camel-cases a kebab-cased property name", async () => {
        await render(<GtkScale adjustment={<GtkAdjustment value={0} lower={0} upper={10} stepIncrement={2} />} />);
        const slider = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        expect(slider.getAdjustment()).toHaveObjectProperty("step-increment", 2);
    });

    it("asserts only presence when no expected value is given", async () => {
        expect(await renderButton("Named")).toHaveObjectProperty("label");
    });

    it("compares GObject values by identity", async () => {
        const slider = await renderSlider(1, 5);
        expect(slider).toHaveObjectProperty("adjustment", slider.getAdjustment());
        expect(slider).not.toHaveObjectProperty("adjustment", new Gtk.Adjustment({ lower: 0, upper: 5 }));
    });

    it("supports an asymmetric matcher as the expected value", async () => {
        expect(await renderButton("Named")).toHaveObjectProperty("label", expect.any(String));
    });

    it.each([
        ["activate", /shadowed by a method/],
        ["not-a-property", /no readable property/],
    ])("throws for the unreadable property %s", async (name, message) => {
        const button = await renderButton("Named");

        expectRejection(() => {
            expect(button).toHaveObjectProperty(name, 1);
        }, message);
    });

    it("throws when the received value is not a GObject", () => {
        expectRejection(() => {
            expect(42).toHaveObjectProperty("label", 1);
        }, /must be a GObject/);
    });
});

describe("description, error message and selection matchers", () => {
    it("toHaveAccessibleDescription reads the accessible description", async () => {
        await render(<GtkButton label="Save" accessibleDescription="Persist changes" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(button).toHaveAccessibleDescription("Persist changes");
    });

    it("toHaveAccessibleErrorMessage reads the related widget's name", async () => {
        await render(<InvalidField />);
        const entry = await screen.findByName("field");
        expect(entry).toHaveAccessibleErrorMessage("Name is required");
    });

    it("toHaveAccessibleErrorMessage reports nothing for a valid widget", async () => {
        expect(await renderEntry("fine")).not.toHaveAccessibleErrorMessage();
    });

    it("toHaveSelection reads an entry's selected text", async () => {
        const entry = await renderEntry("selectable", "hello world");
        entry.selectRegion(0, 5);
        expect(entry).toHaveSelection("hello");
    });
});

describe("checked and value matchers", () => {
    it("toBePartiallyChecked passes for an inconsistent check button", async () => {
        await render(<GtkCheckButton label="Some" inconsistent={true} />);
        const check = await screen.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Some" });
        expect(check).toBePartiallyChecked();
        expect(check).not.toBeChecked();
    });

    it("toHaveValue delegates a string to the display value", async () => {
        expect(await renderEntry("typed", "typed value")).toHaveValue("typed value");
    });

    it("toHaveValue asserts only presence when given no argument", async () => {
        expect(await renderSlider(7, 10)).toHaveValue();
    });

    it.each([
        ["toHaveValue", assertNumericValue, /does not expose a numeric value/],
        ["toHaveDisplayValue", assertDisplayValue, /does not expose a display value/],
    ])("%s throws for a widget that exposes none", async (_name, assert, message) => {
        const label = await renderLabel("Plain");

        expectRejection(() => {
            assert(label);
        }, message);
    });

    it("throws when a text matcher receives a non-widget", () => {
        expectRejection(() => {
            expect("not a widget").toHaveTextContent("x");
        }, /must be a Gtk.Widget/);
    });
});
