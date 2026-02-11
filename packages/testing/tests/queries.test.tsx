import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkExpander,
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
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Save" />
                <GtkButton label="Cancel" />
            </GtkBox>,
        );

        const saveButton = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(saveButton).toBeDefined();
    });

    it("filters by checked state for checkboxes", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkCheckButton label="Unchecked" />
                <GtkCheckButton label="Checked" active />
            </GtkBox>,
        );

        const checkedBox = await findByRole(container, Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checkedBox).toBeDefined();
    });

    it("filters by checked state for toggle buttons", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkToggleButton label="Inactive" />
                <GtkToggleButton label="Active" active />
            </GtkBox>,
        );

        const activeToggle = await findByRole(container, Gtk.AccessibleRole.TOGGLE_BUTTON, { checked: true });
        expect(activeToggle).toBeDefined();
    });

    it("filters by checked state for switches", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkSwitch />
                <GtkSwitch active />
            </GtkBox>,
        );

        const activeSwitch = await findByRole(container, Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(activeSwitch).toBeDefined();
    });

    it("finds expander by label", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkExpander label="Collapsed">Content</GtkExpander>
                <GtkExpander label="Expanded" expanded>
                    Content
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
        it("throws when element not found with role suggestions", async () => {
            const { container } = await render(<GtkLabel label="Test" />);
            await expect(
                findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "NonexistentButton", timeout: 100 }),
            ).rejects.toThrow(/Unable to find an element with role 'BUTTON'/);
        });

        it("throws when multiple elements found", async () => {
            const { container } = await render(
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkButton label="Same" />
                    <GtkButton label="Same" />
                </GtkBox>,
            );
            await expect(findByText(container, "Same", { timeout: 100 })).rejects.toThrow(
                /Found 2 elements with text 'Same'/,
            );
        });
    });
});

describe("findAllByRole", () => {
    it("finds all elements with matching role", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
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
                /Unable to find an element with role 'BUTTON'/,
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
        const { container } = await render(<GtkLabel label=" Hello World " />);
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
                /Unable to find an element with text 'Nonexistent'/,
            );
        });
    });
});

describe("findAllByText", () => {
    it("finds all elements with matching text", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
                <GtkButton label="Different" />
            </GtkBox>,
        );

        const buttons = await findAllByText(container, "Same");
        expect(buttons.length).toBe(2);
    });
});

describe("findByLabelText", () => {
    it("finds entry by its label mnemonic widget", async () => {
        const entryRef = { current: null as Gtk.Entry | null };
        const EntryWithLabel = () => {
            const ref = (el: Gtk.Entry | null) => {
                entryRef.current = el;
            };
            return (
                <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                    <GtkLabel label="Username" mnemonicWidget={entryRef.current} />
                    <GtkEntry ref={ref} />
                </GtkBox>
            );
        };

        const { container, rerender } = await render(<EntryWithLabel />);
        await rerender(<EntryWithLabel />);

        const entry = await findByLabelText(container, "Username");
        expect(entry).toBeDefined();
        expect(entry.getAccessibleRole()).toBe(Gtk.AccessibleRole.TEXT_BOX);
    });

    it("returns nothing when no mnemonic association exists", async () => {
        const { container } = await render(<GtkButton label="Submit" />);
        const result = await findByLabelText(container, "Submit", { timeout: 100 }).catch(() => null);
        expect(result).toBeNull();
    });
});

describe("findAllByLabelText", () => {
    it("finds all elements labelled by matching GtkLabels", async () => {
        const ref1 = { current: null as Gtk.Entry | null };
        const ref2 = { current: null as Gtk.Entry | null };
        const Form = () => (
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkLabel label="Field" mnemonicWidget={ref1.current} />
                <GtkEntry
                    ref={(el) => {
                        ref1.current = el;
                    }}
                />
                <GtkLabel label="Field" mnemonicWidget={ref2.current} />
                <GtkEntry
                    ref={(el) => {
                        ref2.current = el;
                    }}
                />
            </GtkBox>
        );

        const { container, rerender } = await render(<Form />);
        await rerender(<Form />);

        const entries = await findAllByLabelText(container, "Field");
        expect(entries.length).toBe(2);
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
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );

        const entries = await findAllByTestId(container, "field");
        expect(entries.length).toBe(2);
    });
});
