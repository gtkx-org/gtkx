import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwToggle, AdwToggleGroup } from "@gtkx/jsx/adw";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkExpander,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScale,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { render, screen, waitFor, within } from "@gtkx/testing";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import {
    renderButton,
    renderEntry,
    renderLabel,
    renderNamedBox,
    renderSlider,
    renderStyledButton,
    VBox,
    withStolenActivation,
} from "./widget-fixtures.js";

const InvalidField = (): ReactNode => {
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
};

const renderToggle = async (pressed?: Gtk.AccessibleTristate): Promise<Gtk.ToggleButton> => {
    const { container } = await render(<GtkToggleButton name="toggle" label="Bold" accessiblePressed={pressed} />);

    return within(container).findByName("toggle", { as: Gtk.ToggleButton });
};

const renderOrderedTree = async (): Promise<Gtk.Widget> => {
    await render(
        <VBox>
            <GtkBox name="first">
                <GtkLabel>Alpha</GtkLabel>
            </GtkBox>
            <GtkLabel>Beta</GtkLabel>
            <GtkLabel visible={false}>Hidden</GtkLabel>
            <GtkLabel>Gamma</GtkLabel>
        </VBox>,
    );

    return screen.findByName("first");
};

const renderForm = async (): Promise<Gtk.Widget> => {
    await render(
        <GtkBox name="form">
            <GtkLabel>Sign in</GtkLabel>
            <GtkEntry accessibleLabel="Email address" placeholderText="Email" text="ada@example.com" />
            <GtkButton label="Submit" />
            <GtkButton label="Cancel" />
        </GtkBox>,
    );

    return screen.findByName("form");
};

describe("text and value matchers", () => {
    it("read a label's text, normalizing whitespace unless told otherwise", async () => {
        const plain = await renderLabel("Hello world");
        expect(plain).toHaveTextContent(/world/);
        expect(plain).not.toHaveTextContent("goodbye");
        const spaced = await renderLabel("  Spaced \n\t out  ", "Spaced out");
        expect(spaced).toHaveTextContent("Spaced out");
        expect(spaced).not.toHaveTextContent("Spaced out", { normalizeWhitespace: false });
        expect(spaced).toHaveTextContent("Spaced \n\t out", { normalizeWhitespace: false });
        const nonBreaking = await renderLabel("Sticky\u{A0}pair", "Sticky pair");
        expect(nonBreaking).toHaveTextContent("Sticky pair", { normalizeWhitespace: false });
    });

    it("read an accessible name, a display value and a selection", async () => {
        expect(await renderButton("Save")).toHaveAccessibleName("Save");
        const entry = await renderEntry("typed", "hello world");
        expect(entry).toHaveDisplayValue(/hello/);
        expect(entry).toHaveValue("hello world");
        expect(entry).not.toHaveDisplayValue("other");
        entry.selectRegion(0, 5);
        expect(entry).toHaveSelection("hello");
        const slider = await renderSlider(42, 100);
        expect(slider).toHaveValue(42);
        expect(slider).toHaveValue();
        expect(slider).not.toHaveValue(43);
    });

    it("throw for a widget or a value that exposes neither", async () => {
        const label = await renderLabel("Plain");

        expect(() => {
            expect(label).toHaveValue(1);
        }).toThrow();

        expect(() => {
            expect(label).toHaveDisplayValue("x");
        }).toThrow();

        expect(() => {
            expect("not a widget").toHaveTextContent("x");
        }).toThrow();
    });
});

describe("state matchers", () => {
    it("read sensitivity, visibility and rooting", async () => {
        await render(
            <GtkBox opacity={0}>
                <GtkLabel>Faded</GtkLabel>
            </GtkBox>,
        );

        expect(await screen.findByText("Faded")).not.toBeVisible();
        await render(<GtkButton label="Save" sensitive={false} />);
        const disabled = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(disabled).toBeDisabled();
        expect(disabled).not.toBeEnabled();
        const enabled = await renderButton("Press");
        expect(enabled).toBeEnabled();
        expect(enabled).toBeVisible();
        expect(enabled).toBeRooted();
        expect(enabled).toHaveRole(Gtk.AccessibleRole.BUTTON);
        expect(enabled).not.toHaveRole(Gtk.AccessibleRole.CHECKBOX);
        expect(new Gtk.Label({ label: "Detached" })).not.toBeRooted();
        expect(null).not.toBeRooted();
    });

    it("read emptiness, validity and containment", async () => {
        const box = await renderNamedBox("empty-box");
        expect(box).toBeEmptyWidget();
        expect(box).not.toContainElement(null);
        expect(await renderLabel("Filled")).not.toBeEmptyWidget();
        await render(<GtkEntry name="bad" accessibleInvalid={Gtk.AccessibleInvalidState.TRUE} />);
        expect(await screen.findByName("bad")).toBeInvalid();
        const good = await renderEntry("good");
        expect(good).toBeValid();
        expect(good).not.toBeInvalid();

        await render(
            <GtkBox name="outer">
                <GtkLabel>Inside</GtkLabel>
            </GtkBox>,
        );

        const outer = await screen.findByName("outer");
        const inside = await screen.findByText("Inside");
        expect(outer).toContainElement(inside);
        expect(inside).toContainElement(inside);
    });

    it("read focus, and fail once the window holding it loses activation", async () => {
        const entry = await renderEntry("focused");
        entry.grabFocus();
        expect(entry).toHaveFocus();

        await withStolenActivation(async () => {
            await waitFor(() => {
                expect(entry).not.toHaveFocus();
            });

            expect(() => {
                expect(entry).toHaveFocus();
            }).toThrow();
        });
    });

    it("read checked, pressed and mixed states across widget families", async () => {
        const { container: checksContainer } = await render(
            <VBox>
                <GtkCheckButton label="Accept" active={true} />
                <GtkCheckButton label="Some" inconsistent={true} />
                <GtkToggleButton label="Bold" active={true} />
            </VBox>,
        );

        const checks = within(checksContainer);
        const inconsistent = await checks.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Some" });
        expect(await checks.findByRole(Gtk.AccessibleRole.CHECKBOX, { name: "Accept" })).toBeChecked();
        expect(inconsistent).toBePartiallyChecked();
        expect(inconsistent).not.toBeChecked();
        expect(await checks.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Bold" })).toBePressed();
        expect(await renderToggle(Gtk.AccessibleTristate.MIXED)).toBePartiallyPressed();
        expect(await renderToggle(Gtk.AccessibleTristate.TRUE)).not.toBePartiallyPressed();

        const { container: togglesContainer } = await render(
            <AdwToggleGroup>
                <AdwToggle name="list" label="List" />
                <AdwToggle name="grid" label="Grid" />
            </AdwToggleGroup>,
        );

        const toggles = within(togglesContainer);
        expect(await toggles.findByRole(Gtk.AccessibleRole.RADIO, { name: "List" })).toBeChecked();
        expect(await toggles.findByRole(Gtk.AccessibleRole.RADIO, { name: "Grid" })).not.toBeChecked();
    });

    it("throw for a widget that exposes no such state", async () => {
        const label = await renderLabel("plain");

        expect(() => {
            expect(label).toBeChecked();
        }).toThrow();

        expect(() => {
            expect(label).toBePartiallyPressed();
        }).toThrow();
    });
});

describe("toHaveClass", () => {
    it("matches a single class, a whitespace separated list, a pattern and the whole set", async () => {
        const button = await renderStyledButton(["suggested-action", "pill"]);
        expect(button).toHaveClass();
        expect(button).toHaveClass("pill");
        expect(button).toHaveClass("pill suggested-action");
        expect(button).toHaveClass(/^suggested/);
        expect(button).toHaveClass("pill", "suggested-action", { exact: true });
        expect(button).not.toHaveClass("pill", { exact: true });
    });

    it("throws when a pattern is combined with the exact option", async () => {
        const button = await renderStyledButton(["pill"]);

        expect(() => {
            expect(button).toHaveClass(/pill/, { exact: true });
        }).toThrow();
    });
});

describe("toHaveObjectProperty", () => {
    it("reads properties by camel or kebab case, by identity and through asymmetric matchers", async () => {
        await render(<GtkScale adjustment={<GtkAdjustment value={1} lower={0} upper={100} stepIncrement={2} />} />);
        const slider = await screen.findByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
        expect(slider.getAdjustment()).toHaveObjectProperty("upper", 100);
        expect(slider.getAdjustment()).toHaveObjectProperty("step-increment", 2);
        expect(slider).toHaveObjectProperty("adjustment", slider.getAdjustment());
        expect(slider).not.toHaveObjectProperty("adjustment", new Gtk.Adjustment({ lower: 0, upper: 5 }));
        const button = await renderButton("Named");
        expect(button).toHaveObjectProperty("label");
        expect(button).toHaveObjectProperty("label", expect.any(String));
        const model = Gtk.MapListModel.new(null, null);
        expect(model.hasMap()).toBe(false);
        expect(model).toHaveObjectProperty("hasMap", false);
    });

    it("throws for a method without a property, an unknown name and a non-GObject", async () => {
        const button = await renderButton("Named");

        expect(() => {
            expect(button).toHaveObjectProperty("activate", 1);
        }).toThrow();

        expect(() => {
            expect(button).toHaveObjectProperty("not-a-property", 1);
        }).toThrow();

        expect(() => {
            expect(42).toHaveObjectProperty("label", 1);
        }).toThrow();
    });
});

describe("accessible state and property matchers", () => {
    it("read plain, optional and tristate states", async () => {
        await render(<GtkBox name="loading" accessibleBusy={true} />);
        const box = await screen.findByName("loading");
        expect(box).toHaveAccessibleState(Gtk.AccessibleState.BUSY, true);
        expect(box).not.toHaveAccessibleState(Gtk.AccessibleState.BUSY, false);

        await render(
            <GtkExpander name="expander" label="Details">
                <GtkLabel>Body</GtkLabel>
            </GtkExpander>,
        );

        const expander = await screen.findByName("expander", { as: Gtk.Expander });
        expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
        expander.setExpanded(true);
        expect(expander).toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, true);
        const mixed = await renderToggle(Gtk.AccessibleTristate.MIXED);
        expect(mixed).toHaveAccessibleState(Gtk.AccessibleState.PRESSED, Gtk.AccessibleTristate.MIXED);
        expect(mixed).not.toHaveAccessibleState(Gtk.AccessibleState.PRESSED, Gtk.AccessibleTristate.TRUE);
        expect(mixed).toHaveAccessibleState(Gtk.AccessibleState.PRESSED);
        expect(mixed).not.toHaveAccessibleState(Gtk.AccessibleState.BUSY);
    });

    it("read the selected state of a row and the invalid token of an entry", async () => {
        await render(
            <GtkListBox selectionMode={Gtk.SelectionMode.SINGLE}>
                <GtkListBoxRow name="row">
                    <GtkLabel>Row</GtkLabel>
                </GtkListBoxRow>
            </GtkListBox>,
        );

        const row = await screen.findByName("row", { as: Gtk.ListBoxRow });
        expect(row).toHaveAccessibleState(Gtk.AccessibleState.SELECTED, true);
        await render(<GtkEntry name="field" accessibleInvalid={Gtk.AccessibleInvalidState.SPELLING} />);
        const entry = await screen.findByName("field");
        expect(entry).toHaveAccessibleState(Gtk.AccessibleState.INVALID, Gtk.AccessibleInvalidState.SPELLING);
        expect(entry).not.toHaveAccessibleState(Gtk.AccessibleState.INVALID, Gtk.AccessibleInvalidState.TRUE);
    });

    it("fail rather than throw for a widget that declares nothing", async () => {
        const label = await renderLabel("Plain");
        expect(label).not.toHaveAccessibleState(Gtk.AccessibleState.EXPANDED);
        expect(label).not.toHaveAccessibleState(Gtk.AccessibleState.EXPANDED, false);
    });

    it("read string, boolean, numeric and token properties", async () => {
        await render(
            <GtkBox
                name="tokens"
                accessibleRoleDescription="palette"
                accessibleHasPopup={true}
                accessibleModal={false}
                accessibleLevel={3}
                accessibleValueNow={7.5}
                accessibleKeyShortcuts="Control+N"
                accessibleSort={Gtk.AccessibleSort.DESCENDING}
                accessibleOrientation={Gtk.Orientation.VERTICAL}
                accessibleAutocomplete={Gtk.AccessibleAutocomplete.INLINE}
            />,
        );

        const box = await screen.findByName("tokens");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.ROLE_DESCRIPTION, "palette");
        expect(box).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.ROLE_DESCRIPTION, "toolbar");
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.HAS_POPUP, true);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.MODAL, false);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.LEVEL, 3);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 7.5);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.SORT, Gtk.AccessibleSort.DESCENDING);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.ORIENTATION, Gtk.Orientation.VERTICAL);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.AUTOCOMPLETE, Gtk.AccessibleAutocomplete.INLINE);
        expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.KEY_SHORTCUTS);
        expect(box).not.toHaveAccessibleProperty(Gtk.AccessibleProperty.SORT, Gtk.AccessibleSort.ASCENDING);
    });

    it("read the accessible description and the error message a relation points at", async () => {
        await render(<GtkButton label="Save" accessibleDescription="Persist changes" />);
        const button = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(button).toHaveAccessibleDescription("Persist changes");
        await render(<InvalidField />);
        expect(await screen.findByName("field")).toHaveAccessibleErrorMessage("Name is required");
        expect(await renderEntry("fine")).not.toHaveAccessibleErrorMessage();
    });

    it("throws when a property reading misses the expected value", async () => {
        const box = await renderNamedBox("plain");

        expect(() => {
            expect(box).toHaveAccessibleProperty(Gtk.AccessibleProperty.VALUE_NOW, 5);
        }).toThrow();
    });
});

describe("order matchers", () => {
    it("compare siblings, branches and widgets the queries skip", async () => {
        const first = await renderOrderedTree();
        const alpha = await screen.findByText("Alpha");
        const beta = await screen.findByText("Beta");
        const gamma = await screen.findByText("Gamma");
        const hidden = beta.getNextSibling();
        expect(beta).toAppearBefore(gamma);
        expect(gamma).toAppearAfter(beta);
        expect(gamma).not.toAppearBefore(beta);
        expect(alpha).toAppearBefore(beta);
        expect(first).toAppearBefore(beta);
        expect(hidden).toAppearAfter(beta);
        expect(hidden).toAppearBefore(gamma);
    });

    it("reject a containing widget and a widget rooted in another tree", async () => {
        const first = await renderOrderedTree();
        const alpha = await screen.findByText("Alpha");
        expect(first).not.toAppearBefore(alpha);
        expect(alpha).not.toAppearAfter(first);
        expect(first).not.toAppearBefore(new Gtk.Label({ label: "Detached" }));
        expect(first).not.toAppearAfter(new Gtk.Label({ label: "Detached" }));
    });
});

describe("containment matchers", () => {
    it("count matches by role, text, label text, placeholder text and display value", async () => {
        const form = await renderForm();
        expect(form).toContainAnyByRole(Gtk.AccessibleRole.BUTTON);
        expect(form).not.toContainOneByRole(Gtk.AccessibleRole.BUTTON);
        expect(form).toContainOneByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" });
        expect(form).not.toContainAnyByRole(Gtk.AccessibleRole.SLIDER);
        expect(form).toContainOneByText("Sign in");
        expect(form).not.toContainAnyByText("Sign out");
        expect(form).toContainOneByLabelText("Email address");
        expect(form).not.toContainAnyByLabelText("Postal address");
        expect(form).toContainOneByPlaceholderText("Email");
        expect(form).not.toContainAnyByPlaceholderText("Password");
        expect(form).toContainOneByDisplayValue("ada@example.com");
        expect(form).not.toContainAnyByDisplayValue("grace@example.com");
    });
});
