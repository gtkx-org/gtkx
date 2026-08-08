import * as Gtk from "@gtkx/gi/gtk";
import { GtkBox, GtkButton, GtkEntry, GtkLabel } from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import { render, screen } from "../src/index.js";
import { VBox } from "./widget-fixtures.js";

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

const renderSiblingLabels = async (): Promise<[Gtk.Widget, Gtk.Widget]> => {
    await renderOrderedTree();

    return Promise.all([screen.findByText("Beta"), screen.findByText("Gamma")]);
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

describe("toAppearBefore and toAppearAfter", () => {
    it("compare siblings in widget-tree order", async () => {
        const [beta, gamma] = await renderSiblingLabels();
        expect(beta).toAppearBefore(gamma);
        expect(gamma).toAppearAfter(beta);
        expect(gamma).not.toAppearBefore(beta);
        expect(beta).not.toAppearAfter(gamma);
    });

    it("compare across branches rather than only between siblings", async () => {
        const first = await renderOrderedTree();
        const alpha = await screen.findByText("Alpha");
        const beta = await screen.findByText("Beta");
        expect(alpha).toAppearBefore(beta);
        expect(first).toAppearBefore(beta);
    });

    it("order widgets the queries skip because they are not mapped", async () => {
        const [beta, gamma] = await renderSiblingLabels();
        const hidden = beta.getNextSibling();
        expect(hidden).toBeInstanceOf(Gtk.Label);
        expect(hidden).toAppearAfter(beta);
        expect(hidden).toAppearBefore(gamma);
    });

    it("reject a widget that contains the other", async () => {
        const first = await renderOrderedTree();
        const alpha = await screen.findByText("Alpha");
        expect(first).not.toAppearBefore(alpha);
        expect(alpha).not.toAppearAfter(first);
    });

    it("reject a widget rooted in another tree", async () => {
        const first = await renderOrderedTree();
        expect(first).not.toAppearBefore(new Gtk.Label({ label: "Detached" }));
        expect(first).not.toAppearAfter(new Gtk.Label({ label: "Detached" }));
    });
});

describe("toContainAnyBy and toContainOneBy", () => {
    it("count matches by role", async () => {
        const form = await renderForm();
        expect(form).toContainAnyByRole(Gtk.AccessibleRole.BUTTON);
        expect(form).not.toContainOneByRole(Gtk.AccessibleRole.BUTTON);
        expect(form).toContainOneByRole(Gtk.AccessibleRole.BUTTON, { name: "Submit" });
        expect(form).not.toContainAnyByRole(Gtk.AccessibleRole.SLIDER);
    });

    it("count matches by text", async () => {
        const form = await renderForm();
        expect(form).toContainAnyByText("Sign in");
        expect(form).toContainOneByText("Sign in");
        expect(form).not.toContainAnyByText("Sign out");
    });

    it("count matches by label text", async () => {
        const form = await renderForm();
        expect(form).toContainAnyByLabelText("Email address");
        expect(form).toContainOneByLabelText("Email address");
        expect(form).not.toContainAnyByLabelText("Postal address");
    });

    it("count matches by placeholder text", async () => {
        const form = await renderForm();
        expect(form).toContainAnyByPlaceholderText("Email");
        expect(form).toContainOneByPlaceholderText("Email");
        expect(form).not.toContainAnyByPlaceholderText("Password");
    });

    it("count matches by display value", async () => {
        const form = await renderForm();
        expect(form).toContainAnyByDisplayValue("ada@example.com");
        expect(form).toContainOneByDisplayValue("ada@example.com");
        expect(form).not.toContainAnyByDisplayValue("grace@example.com");
    });
});
