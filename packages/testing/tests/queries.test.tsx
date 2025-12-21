import { getApplication } from "@gtkx/ffi";
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
import { afterEach, describe, expect, it } from "vitest";
import {
    cleanup,
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

afterEach(async () => {
    await cleanup();
});

describe("findByRole", () => {
    it("finds element by accessible role", async () => {
        await render(<GtkButton label="Test" />);
        const app = getApplication();
        const button = await findByRole(app, Gtk.AccessibleRole.BUTTON);
        expect(button).toBeDefined();
    });

    it("filters by name option", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="Save" />
                <GtkButton label="Cancel" />
            </GtkBox>,
        );

        const app = getApplication();
        const saveButton = await findByRole(app, Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(saveButton).toBeDefined();
    });

    it("filters by checked state for checkboxes", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkCheckButton.Root label="Unchecked" />
                <GtkCheckButton.Root label="Checked" active />
            </GtkBox>,
        );

        const app = getApplication();
        const checkedBox = await findByRole(app, Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checkedBox).toBeDefined();
    });

    it("filters by checked state for toggle buttons", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkToggleButton.Root label="Inactive" />
                <GtkToggleButton.Root label="Active" active />
            </GtkBox>,
        );

        const app = getApplication();
        const activeToggle = await findByRole(app, Gtk.AccessibleRole.TOGGLE_BUTTON, { checked: true });
        expect(activeToggle).toBeDefined();
    });

    it("filters by checked state for switches", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkSwitch />
                <GtkSwitch active />
            </GtkBox>,
        );

        const app = getApplication();
        const activeSwitch = await findByRole(app, Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(activeSwitch).toBeDefined();
    });

    it("finds expander by label", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkExpander.Root label="Collapsed">
                    <GtkLabel label="Content" />
                </GtkExpander.Root>
                <GtkExpander.Root label="Expanded" expanded>
                    <GtkLabel label="Content" />
                </GtkExpander.Root>
            </GtkBox>,
        );

        const app = getApplication();
        const expandedButton = await findByRole(app, Gtk.AccessibleRole.BUTTON, { name: "Expanded" });
        expect(expandedButton).toBeDefined();
    });

    it("supports regex name matching", async () => {
        await render(<GtkButton label="Submit Form" />);
        const app = getApplication();
        const button = await findByRole(app, Gtk.AccessibleRole.BUTTON, { name: /submit/i });
        expect(button).toBeDefined();
    });

    it("supports function matcher for name", async () => {
        await render(<GtkButton label="Click Here" />);
        const app = getApplication();
        const button = await findByRole(app, Gtk.AccessibleRole.BUTTON, {
            name: (text) => text.includes("Click"),
        });
        expect(button).toBeDefined();
    });

    describe("error handling", () => {
        it("throws when element not found", async () => {
            await render(<GtkLabel label="Test" />);
            const app = getApplication();
            await expect(findByRole(app, Gtk.AccessibleRole.BUTTON, { timeout: 100 })).rejects.toThrow(
                "Unable to find any elements",
            );
        });

        it("throws when multiple elements found", async () => {
            await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                    <GtkButton label="First" />
                    <GtkButton label="Second" />
                </GtkBox>,
            );
            const app = getApplication();
            await expect(findByRole(app, Gtk.AccessibleRole.BUTTON, { timeout: 100 })).rejects.toThrow(
                "Found 2 elements",
            );
        });
    });
});

describe("findAllByRole", () => {
    it("finds all elements with matching role", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="First" />
                <GtkButton label="Second" />
                <GtkLabel label="Text" />
            </GtkBox>,
        );

        const app = getApplication();
        const buttons = await findAllByRole(app, Gtk.AccessibleRole.BUTTON);
        expect(buttons.length).toBe(2);
    });

    describe("error handling", () => {
        it("throws when no elements found", async () => {
            await render(<GtkLabel label="Test" />);
            const app = getApplication();
            await expect(findAllByRole(app, Gtk.AccessibleRole.BUTTON, { timeout: 100 })).rejects.toThrow(
                "Unable to find any elements",
            );
        });
    });
});

describe("findByText", () => {
    it("finds element by exact text", async () => {
        await render(<GtkLabel label="Hello World" />);
        const app = getApplication();
        const label = await findByText(app, "Hello World");
        expect(label).toBeDefined();
    });

    it("finds element by partial text with exact false", async () => {
        await render(<GtkLabel label="Hello World" />);
        const app = getApplication();
        const label = await findByText(app, "Hello", { exact: false });
        expect(label).toBeDefined();
    });

    it("normalizes whitespace by default", async () => {
        await render(<GtkLabel label="  Hello   World  " />);
        const app = getApplication();
        const label = await findByText(app, "Hello World");
        expect(label).toBeDefined();
    });

    it("supports custom normalizer", async () => {
        await render(<GtkLabel label="HELLO WORLD" />);
        const app = getApplication();
        const label = await findByText(app, "hello world", {
            normalizer: (text) => text.toLowerCase(),
        });
        expect(label).toBeDefined();
    });

    describe("error handling", () => {
        it("throws when text not found", async () => {
            await render(<GtkLabel label="Test" />);
            const app = getApplication();
            await expect(findByText(app, "Nonexistent", { timeout: 100 })).rejects.toThrow(
                "Unable to find any elements",
            );
        });
    });
});

describe("findAllByText", () => {
    it("finds all elements with matching text", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkLabel label="Same" />
                <GtkLabel label="Same" />
                <GtkLabel label="Different" />
            </GtkBox>,
        );

        const app = getApplication();
        const labels = await findAllByText(app, "Same");
        expect(labels.length).toBe(2);
    });
});

describe("findByLabelText", () => {
    it("finds button by label", async () => {
        await render(<GtkButton label="Submit" />);
        const app = getApplication();
        const button = await findByLabelText(app, "Submit");
        expect(button).toBeDefined();
    });

    it("finds frame by label", async () => {
        await render(
            <GtkFrame.Root label="Settings">
                <GtkLabel label="Content" />
            </GtkFrame.Root>,
        );

        const app = getApplication();
        const frame = await findByRole(app, Gtk.AccessibleRole.GROUP, { name: "Settings" });
        expect(frame).toBeDefined();
    });
});

describe("findAllByLabelText", () => {
    it("finds all elements with matching label", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkButton label="Action" />
                <GtkButton label="Action" />
            </GtkBox>,
        );

        const app = getApplication();
        const buttons = await findAllByLabelText(app, "Action");
        expect(buttons.length).toBe(2);
    });
});

describe("findByTestId", () => {
    it("finds element by widget name as test id", async () => {
        await render(<GtkEntry name="email-input" />);
        const app = getApplication();
        const entry = await findByTestId(app, "email-input");
        expect(entry).toBeDefined();
    });

    it("supports regex matching", async () => {
        await render(<GtkEntry name="form-field-email" />);
        const app = getApplication();
        const entry = await findByTestId(app, /form-field/);
        expect(entry).toBeDefined();
    });
});

describe("findAllByTestId", () => {
    it("finds all elements with matching test id", async () => {
        await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );

        const app = getApplication();
        const entries = await findAllByTestId(app, "field");
        expect(entries.length).toBe(2);
    });
});
