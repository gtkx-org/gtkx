import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { ControlFixture, controlMeta, controlStories, replaceControl, showInspector } from "./fixtures/inspector.js";

describe("native story controls", () => {
    it("edits boolean, text, numeric, and choice arguments without remounting the component", async () => {
        await showInspector(controlStories);
        await userEvent.click(screen.getByText("Increment local state"));
        await userEvent.click(screen.getByName("storybook-control-enabled"));
        await replaceControl("text", "Updated");
        await replaceControl("quantity", "7");
        await userEvent.selectOptions(screen.getByName("storybook-control-choice"), 2);

        expect(screen.getByName("inspector-enabled")).toHaveTextContent(/^true$/);
        expect(screen.getByName("inspector-text")).toHaveTextContent(/^Updated$/);
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^7$/);
        expect(screen.getByName("inspector-choice")).toHaveTextContent(/^"red"$/);
        expect(screen.getByName("inspector-clicks")).toHaveTextContent(/^1$/);
    });

    it("resets composed defaults and component state and isolates arguments when switching", async () => {
        await showInspector(controlStories);
        await replaceControl("text", "Edited");
        await userEvent.click(screen.getByText("Increment local state"));
        await userEvent.click(screen.getByText("Reset story"));

        expect(screen.getByName("inspector-text")).toHaveTextContent(/^Initial$/);
        expect(screen.getByName("inspector-clicks")).toHaveTextContent(/^0$/);
        await replaceControl("text", "Edited again");
        await userEvent.click(screen.getByName("storybook-story-inspector--alternate"));
        expect(screen.getByName("inspector-text")).toHaveTextContent(/^Alternate$/);
        expect(screen.getByName("inspector-enabled")).toHaveTextContent(/^true$/);
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^8$/);
        await userEvent.click(screen.getByName("storybook-story-inspector--default"));
        expect(screen.getByName("inspector-text")).toHaveTextContent(/^Initial$/);
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^2$/);
    });

    it("leaves absent arguments unset until controls are edited and restores absence on reset", async () => {
        await showInspector({ default: { ...controlMeta, args: {} }, Default: {} });

        for (const argument of ["text", "enabled", "quantity", "choice"]) {
            expect(screen.getByName(`inspector-${argument}`)).toHaveTextContent(/^unset$/);
        }

        await replaceControl("text", "Defined");
        await userEvent.click(screen.getByName("storybook-control-enabled"));
        await replaceControl("quantity", "5");
        await userEvent.selectOptions(screen.getByName("storybook-control-choice"), 1);

        expect(screen.getByName("inspector-text")).toHaveTextContent(/^Defined$/);
        expect(screen.getByName("inspector-enabled")).toHaveTextContent(/^true$/);
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^5$/);
        expect(screen.getByName("inspector-choice")).toHaveTextContent(/^"blue"$/);
        await userEvent.click(screen.getByText("Reset story"));

        for (const argument of ["text", "enabled", "quantity", "choice"]) {
            expect(screen.getByName(`inspector-${argument}`)).toHaveTextContent(/^unset$/);
        }
    });

    it("hides excluded controls and keeps disabled controls out of editing", async () => {
        await showInspector({
            default: {
                ...controlMeta,
                argTypes: {
                    text: { control: { type: "text", disable: true } },
                    enabled: { control: false },
                    quantity: { control: "number", table: { disable: true } },
                    choice: {},
                },
            },
            Default: {},
        });

        expect(screen.getByName("storybook-control-text")).toBeDisabled();
        expect(screen.queryByName("storybook-control-enabled")).toBeNull();
        expect(screen.queryByName("storybook-control-quantity")).toBeNull();
        expect(screen.queryByName("storybook-control-choice")).toBeNull();
        await userEvent.click(screen.getByText("Increment local state"));
        expect(screen.getByName("inspector-clicks")).toHaveTextContent(/^1$/);
    });

    it.each([
        { type: "number", min: 10, max: 0 },
        { type: "number", step: 0 },
        { type: "number", min: NaN },
        { type: "number", min: 3, max: 10 },
        { type: "number", min: 0, max: 1 },
        { type: "object" },
    ])("keeps invalid numeric or unsupported control settings from changing the preview", async (control) => {
        await showInspector({
            default: { ...controlMeta, argTypes: { quantity: { control } } },
            Default: {},
        });

        expect(screen.queryByName("storybook-control-quantity")).toBeNull();
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^2$/);
        await userEvent.click(screen.getByText("Increment local state"));
        expect(screen.getByName("inspector-clicks")).toHaveTextContent(/^1$/);
    });

    it("rejects unsupported option values while leaving the selected story interactive", async () => {
        await showInspector({
            default: {
                ...controlMeta,
                argTypes: { choice: { control: "select", options: [{ nested: "value" }] } },
            },
            Default: {},
        });

        expect(screen.queryByName("storybook-control-choice")).toBeNull();
        expect(screen.getByName("inspector-choice")).toHaveTextContent(/^"green"$/);
        await userEvent.click(screen.getByText("Increment local state"));
        expect(screen.getByName("inspector-clicks")).toHaveTextContent(/^1$/);
    });

    it.each([NaN, Infinity, "invalid"])(
        "keeps unsupported numeric arguments out of editable number controls",
        async (quantity) => {
            await showInspector({
                default: { ...controlMeta, args: { quantity }, argTypes: { quantity: { control: "number" } } },
                Default: {},
            });

            expect(screen.queryByName("storybook-control-quantity")).toBeNull();
            await userEvent.click(screen.getByText("Increment local state"));
            expect(screen.getByName("inspector-clicks")).toHaveTextContent(/^1$/);
        },
    );

    it("keeps numeric edits finite and within declared bounds", async () => {
        await showInspector(controlStories);
        await replaceControl("quantity", "999");
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^10$/);

        await replaceControl("quantity", "not a number");
        await replaceControl("quantity", "4");
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^4$/);
        await userEvent.click(screen.getByText("Reset story"));
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^2$/);
    });

    it("preserves primitive option types when selecting booleans and numbers", async () => {
        await showInspector({
            default: {
                title: "Inspector",
                component: ControlFixture,
                args: { choice: null },
                argTypes: { choice: { control: "select", options: [null, true, 42] } },
            },
            Default: {},
        });

        await userEvent.selectOptions(screen.getByName("storybook-control-choice"), 1);
        expect(screen.getByName("inspector-choice")).toHaveTextContent(/^true$/);
        await userEvent.selectOptions(screen.getByName("storybook-control-choice"), 2);
        expect(screen.getByName("inspector-choice")).toHaveTextContent(/^42$/);
    });

    it("preserves fractional values and step increments in range controls", async () => {
        await showInspector({
            default: {
                ...controlMeta,
                args: { quantity: 0.25 },
                argTypes: { quantity: { control: { type: "range", min: -1, max: 1, step: 0.25 } } },
            },
            Default: {},
        });
        const spin = within(screen.getByName("storybook-control-quantity")).getByRole(Gtk.AccessibleRole.SPIN_BUTTON);
        expect(spin).toHaveDisplayValue("0.25");

        await userEvent.keyboard(spin, "{ArrowUp}");
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^0.5$/);
        await replaceControl("quantity", "-0.75");
        expect(screen.getByName("inspector-quantity")).toHaveTextContent(/^-0.75$/);
    });
});
