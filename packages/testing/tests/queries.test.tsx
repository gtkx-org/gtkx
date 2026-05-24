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
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import {
    findAllByLabelText,
    findAllByName,
    findAllByRole,
    findAllByText,
    findByLabelText,
    findByName,
    findByRole,
    findByText,
    render,
} from "../src/index.js";

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

describe("findByRole", () => {
    it("finds element by accessible role", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Test" });
        expect(button).toBeDefined();
    });

    it("filters by name option", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Save" />
                <GtkButton label="Cancel" />
            </VBox>,
        );

        const saveButton = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(saveButton).toBeDefined();
    });

    it("filters by checked state for checkboxes", async () => {
        const { container } = await render(
            <VBox>
                <GtkCheckButton label="Unchecked" />
                <GtkCheckButton label="Checked" active />
            </VBox>,
        );

        const checkedBox = await findByRole(container, Gtk.AccessibleRole.CHECKBOX, { checked: true });
        expect(checkedBox).toBeDefined();
    });

    it("filters by checked state for toggle buttons", async () => {
        const { container } = await render(
            <VBox>
                <GtkToggleButton label="Inactive" />
                <GtkToggleButton label="Active" active />
            </VBox>,
        );

        const activeToggle = await findByRole(container, Gtk.AccessibleRole.TOGGLE_BUTTON, { checked: true });
        expect(activeToggle).toBeDefined();
    });

    it("filters by checked state for switches", async () => {
        const { container } = await render(
            <VBox>
                <GtkSwitch />
                <GtkSwitch active />
            </VBox>,
        );

        const activeSwitch = await findByRole(container, Gtk.AccessibleRole.SWITCH, { checked: true });
        expect(activeSwitch).toBeDefined();
    });
});

describe("findByRole matchers", () => {
    it("finds expander by label", async () => {
        const { container } = await render(
            <VBox>
                <GtkExpander label="Collapsed">Content</GtkExpander>
                <GtkExpander label="Expanded" expanded>
                    Content
                </GtkExpander>
            </VBox>,
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
});

describe("findByRole error handling", () => {
    it("throws when element not found with role suggestions", async () => {
        const { container } = await render(<GtkLabel label="Test" />);
        await expect(
            findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "NonexistentButton", timeout: 100 }),
        ).rejects.toThrow(/Unable to find an element with role 'BUTTON'/);
    });

    it("throws when multiple elements found", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
            </VBox>,
        );
        await expect(findByText(container, "Same", { timeout: 100 })).rejects.toThrow(
            /Found 2 elements with text 'Same'/,
        );
    });
});

describe("findAllByRole", () => {
    it("finds all elements with matching role", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="First" />
                <GtkButton label="Second" />
                <GtkLabel label="Text" />
            </VBox>,
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
            <VBox>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
                <GtkButton label="Different" />
            </VBox>,
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
                <VBox>
                    <GtkLabel label="Username" mnemonicWidget={entryRef.current} />
                    <GtkEntry ref={ref} />
                </VBox>
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
    it("finds all elements labeled by matching GtkLabels", async () => {
        const ref1 = { current: null as Gtk.Entry | null };
        const ref2 = { current: null as Gtk.Entry | null };
        const Form = () => (
            <VBox>
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
            </VBox>
        );

        const { container, rerender } = await render(<Form />);
        await rerender(<Form />);

        const entries = await findAllByLabelText(container, "Field");
        expect(entries.length).toBe(2);
    });
});

describe("findByName", () => {
    it("finds element by widget name", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = await findByName(container, "email-input");
        expect(entry).toBeDefined();
    });

    it("supports regex matching", async () => {
        const { container } = await render(<GtkEntry name="form-field-email" />);
        const entry = await findByName(container, /form-field/);
        expect(entry).toBeDefined();
    });
});

describe("findAllByName", () => {
    it("finds all elements with matching widget name", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </VBox>,
        );

        const entries = await findAllByName(container, "field");
        expect(entries.length).toBe(2);
    });

    it("throws a name-formatted error when no widget matches", async () => {
        const { container } = await render(<GtkEntry name="real-name" />);

        await expect(findByName(container, "missing", { timeout: 100 })).rejects.toThrow(
            /Unable to find an element with name 'missing'/,
        );
    });

    it("throws a regex-formatted name error when no widget matches", async () => {
        const { container } = await render(<GtkEntry name="real-name" />);

        await expect(findByName(container, /^missing/, { timeout: 100 })).rejects.toThrow(
            /Unable to find an element with name \/\^missing\//,
        );
    });

    it("matches a GtkLabel widget by its widget name", async () => {
        const { container } = await render(<GtkLabel name="title-label" label="Hi" />);
        const label = await findByName(container, "title-label");
        expect(label).toBeInstanceOf(Gtk.Label);
    });
});

describe("findByRole(LABEL)", () => {
    it("matches a GtkLabel by its accessible role", async () => {
        const { container } = await render(<GtkLabel label="visible" />);
        const label = await findByRole(container, Gtk.AccessibleRole.LABEL, { name: "visible" });
        expect(label).toBeInstanceOf(Gtk.Label);
    });
});

describe("findByText joins adjacent labels with a space", () => {
    it("inserts a space between sibling labels of the same parent", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel label="Searching for:" />
                <GtkLabel label="rocket" />
            </VBox>,
        );
        const match = await findByText(container, "Searching for: rocket");
        expect(match).toBeInstanceOf(Gtk.Widget);
    });
});

describe("findByRole accessible name", () => {
    it("matches a widget by its accessibleLabel JSX prop", async () => {
        const { container } = await render(
            <GtkButton accessibleLabel="Close dialog" iconName="window-close-symbolic" />,
        );
        const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Close dialog" });
        expect(button).toBeInstanceOf(Gtk.Button);
    });

    it("prefers accessibleLabel over visible label text", async () => {
        const { container } = await render(<GtkButton accessibleLabel="Submit form" label="OK" />);
        const button = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Submit form" });
        expect(button).toBeInstanceOf(Gtk.Button);
    });
});

describe("findByRole level", () => {
    it("matches a widget by its accessibleLevel JSX prop", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel accessibleLevel={1} label="Top" />
                <GtkLabel accessibleLevel={2} label="Section" />
                <GtkLabel accessibleLevel={3} label="Subsection" />
            </VBox>,
        );
        const top = await findByRole(container, Gtk.AccessibleRole.LABEL, { level: 1 });
        const section = await findByRole(container, Gtk.AccessibleRole.LABEL, { level: 2 });
        const subsection = await findByRole(container, Gtk.AccessibleRole.LABEL, { level: 3 });
        expect((top as Gtk.Label).getLabel()).toBe("Top");
        expect((section as Gtk.Label).getLabel()).toBe("Section");
        expect((subsection as Gtk.Label).getLabel()).toBe("Subsection");
    });

    it("rejects widgets whose level differs from the requested value", async () => {
        const { container } = await render(<GtkLabel accessibleLevel={2} label="Heading" />);
        await expect(findByRole(container, Gtk.AccessibleRole.LABEL, { level: 3 })).rejects.toThrow();
    });

    it("rejects widgets that declare no accessibleLevel when one is requested", async () => {
        const { container } = await render(<GtkLabel label="No level" />);
        await expect(findByRole(container, Gtk.AccessibleRole.LABEL, { level: 1 })).rejects.toThrow();
    });

    it("combines with name to disambiguate widgets at the same level", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel accessibleLevel={2} label="First section" />
                <GtkLabel accessibleLevel={2} label="Second section" />
            </VBox>,
        );
        const second = await findByRole(container, Gtk.AccessibleRole.LABEL, {
            level: 2,
            name: "Second section",
        });
        expect((second as Gtk.Label).getLabel()).toBe("Second section");
    });
});
