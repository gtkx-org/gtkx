import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkExpander,
    GtkFrame,
    GtkLabel,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/react";
import { describe, expect, it } from "vitest";
import {
    findAllByLabelText,
    findAllByRole,
    findAllByTestId,
    findAllByText,
    findByLabelText,
    findByRole,
    findByTestId,
    findByText,
    render,
} from "../src/index.js";

describe("findByRole", () => {
    it("finds element by accessible role", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Test" });
        expect(button).toBeDefined();
    });

    it("filters by name option", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="Save" />
                <GtkButton label="Cancel" />
            </GtkBox>,
        );

        const saveButton = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(saveButton).toBeDefined();
    });

    it("filters by checked state for checkboxes", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkCheckButton label="Unchecked" />
                <GtkCheckButton label="Checked" active />
            </GtkBox>,
        );

        const checkedBox = await findByRole(container, Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checkedBox).toBeDefined();
    });

    it("filters by checked state for toggle buttons", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkToggleButton label="Inactive" />
                <GtkToggleButton label="Active" active />
            </GtkBox>,
        );

        const activeToggle = await findByRole(container, Gtk.AccessibleRole.TOGGLE_BUTTON, { checked: true });
        expect(activeToggle).toBeDefined();
    });

    it("filters by checked state for switches", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkSwitch />
                <GtkSwitch active />
            </GtkBox>,
        );

        const activeSwitch = await findByRole(container, Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(activeSwitch).toBeDefined();
    });

    it("finds expander by label", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkExpander label="Collapsed">
                    <GtkLabel label="Content" />
                </GtkExpander>
                <GtkExpander label="Expanded" expanded>
                    <GtkLabel label="Content" />
                </GtkExpander>
            </GtkBox>,
        );

        const expandedButton = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Expanded" });
        expect(expandedButton).toBeDefined();
    });

    it("supports regex name matching", async () => {
        const { container } = await render(<GtkButton label="Submit Form" />);
        const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: /submit/i });
        expect(button).toBeDefined();
    });

    it("supports function matcher for name", async () => {
        const { container } = await render(<GtkButton label="Click Here" />);
        const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, {
            name: (text) => text.includes("Click"),
        });
        expect(button).toBeDefined();
    });

    describe("error handling", () => {
        it("throws when element not found", async () => {
            const { container } = await render(<GtkLabel label="Test" />);
            await expect(
                findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "NonexistentButton", timeout: 100 }),
            ).rejects.toThrow("Unable to find any elements");
        });

        it("throws when multiple elements found", async () => {
            const { container } = await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                    <GtkLabel label="Same" />
                    <GtkLabel label="Same" />
                </GtkBox>,
            );
            await expect(findByText(container, "Same", { timeout: 100 })).rejects.toThrow(
                "Expected 1 element with text 'Same', found 2",
            );
        });
    });
});

describe("findAllByRole", () => {
    it("finds all elements with matching role", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
                <GtkLabel label="Text" />
            </GtkBox>,
        );

        const buttons = await findAllByRole(container, Gtk.AccessibleRole.BUTTON, { name: /First|Second/ });
        expect(buttons.length).toBe(2);
    });

    describe("error handling", () => {
        it("throws when no elements found", async () => {
            const { container } = await render(<GtkLabel label="Test" />);
            await expect(findAllByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 })).rejects.toThrow(
                "Unable to find any elements",
            );
        });
    });
});

describe("findByText", () => {
    it("finds element by exact text", async () => {
        const { container } = await render(<GtkLabel label="Hello World" />);
        const label = await findByText(container, "Hello World");
        expect(label).toBeDefined();
    });

    it("finds element by partial text with exact false", async () => {
        const { container } = await render(<GtkLabel label="Hello World" />);
        const label = await findByText(container, "Hello", { exact: false });
        expect(label).toBeDefined();
    });

    it("normalizes whitespace by default", async () => {
        const { container } = await render(<GtkLabel label="  Hello   World  " />);
        const label = await findByText(container, "Hello World");
        expect(label).toBeDefined();
    });

    it("supports custom normalizer", async () => {
        const { container } = await render(<GtkLabel label="HELLO WORLD" />);
        const label = await findByText(container, "hello world", {
            normalizer: (text) => text.toLowerCase(),
        });
        expect(label).toBeDefined();
    });

    describe("error handling", () => {
        it("throws when text not found", async () => {
            const { container } = await render(<GtkLabel label="Test" />);
            await expect(findByText(container, "Nonexistent", { timeout: 100 })).rejects.toThrow(
                "Unable to find any elements",
            );
        });
    });
});

describe("findAllByText", () => {
    it("finds all elements with matching text", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkLabel label="Same" />
                <GtkLabel label="Same" />
                <GtkLabel label="Different" />
            </GtkBox>,
        );

        const labels = await findAllByText(container, "Same");
        expect(labels.length).toBe(2);
    });
});

describe("findByLabelText", () => {
    it("finds button by label", async () => {
        const { container } = await render(<GtkButton label="Submit" />);
        const button = await findByLabelText(container, "Submit");
        expect(button).toBeDefined();
    });

    it("finds frame by label", async () => {
        const { container } = await render(
            <GtkFrame label="Settings">
                <GtkLabel label="Content" />
            </GtkFrame>,
        );

        const frame = await findByRole(container, Gtk.AccessibleRole.GROUP, { name: "Settings" });
        expect(frame).toBeDefined();
    });
});

describe("findAllByLabelText", () => {
    it("finds all elements with matching label", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="Action" />
                <GtkButton label="Action" />
            </GtkBox>,
        );

        const buttons = await findAllByLabelText(container, "Action");
        expect(buttons.length).toBe(2);
    });
});

describe("findByTestId", () => {
    it("finds element by widget name as test id", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = await findByTestId(container, "email-input");
        expect(entry).toBeDefined();
    });

    it("supports regex matching", async () => {
        const { container } = await render(<GtkEntry name="form-field-email" />);
        const entry = await findByTestId(container, /form-field/);
        expect(entry).toBeDefined();
    });
});

describe("findAllByTestId", () => {
    it("finds all elements with matching test id", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );

        const entries = await findAllByTestId(container, "field");
        expect(entries.length).toBe(2);
    });
});
