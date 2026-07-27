import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkExpander,
    GtkLabel,
    GtkLevelBar,
    GtkProgressBar,
    GtkScale,
    GtkSearchEntry,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import { describe, expect, it } from "vitest";
import {
    findAllByDisplayValue,
    findAllByLabelText,
    findAllByName,
    findAllByPlaceholderText,
    findAllByRole,
    findAllByText,
    findByDisplayValue,
    findByLabelText,
    findByName,
    findByPlaceholderText,
    findByRole,
    findByText,
    getAllByDisplayValue,
    getAllByPlaceholderText,
    getByDisplayValue,
    getByLabelText,
    getByPlaceholderText,
    getByText,
    getDefaultNormalizer,
    queryAllByDisplayValue,
    queryAllByName,
    queryAllByPlaceholderText,
    queryAllByRole,
    queryAllByText,
    queryByDisplayValue,
    queryByName,
    queryByPlaceholderText,
    queryByRole,
    queryByText,
    render,
} from "../src/index.js";

const VBox = ({ children }: { children: ReactNode }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL}>{children}</GtkBox>
);

const renderTwoButtons = () =>
    render(
        <VBox>
            <GtkButton label="First" />
            <GtkButton label="Second" />
        </VBox>,
    );

const queryButtonsBesideHidden = async (hiddenButton: ReactNode) => {
    const { container } = await render(
        <VBox>
            <GtkButton label="Shown" />
            {hiddenButton}
        </VBox>,
    );

    return {
        defaultMatches: queryAllByRole(container, Gtk.AccessibleRole.BUTTON),
        hiddenIncludedMatches: queryAllByRole(container, Gtk.AccessibleRole.BUTTON, { hidden: true }),
    };
};

const normalizer = (text: string) => getDefaultNormalizer()(text).toLowerCase();

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

    it("filters by pressed state for toggle buttons", async () => {
        const { container } = await render(
            <VBox>
                <GtkToggleButton label="Inactive" />
                <GtkToggleButton label="Active" active />
            </VBox>,
        );

        const activeToggle = await findByRole(container, Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true });
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
                <GtkExpander label="Collapsed">
                    <GtkLabel>Content</GtkLabel>
                </GtkExpander>
                <GtkExpander label="Expanded" expanded>
                    <GtkLabel>Content</GtkLabel>
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
        const { container } = await render(<GtkLabel>Test</GtkLabel>);

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
                <GtkLabel>Text</GtkLabel>
            </VBox>,
        );

        const buttons = await findAllByRole(container, Gtk.AccessibleRole.BUTTON, { name: /First|Second/ });
        expect(buttons).toHaveLength(2);
    });

    describe("error handling", () => {
        it("throws when no elements found", async () => {
            const { container } = await render(<GtkLabel>Test</GtkLabel>);

            await expect(findAllByRole(container, Gtk.AccessibleRole.BUTTON, { timeout: 100 })).rejects.toThrow(
                /Unable to find an element with role 'BUTTON'/,
            );
        });
    });
});

describe("findByText", () => {
    it("finds element by exact text", async () => {
        const { container } = await render(<GtkLabel>Hello World</GtkLabel>);
        const label = await findByText(container, "Hello World");
        expect(label).toBeDefined();
    });

    it("finds element by partial text with exact false", async () => {
        const { container } = await render(<GtkLabel>Hello World</GtkLabel>);
        const label = await findByText(container, "Hello", { exact: false });
        expect(label).toBeDefined();
    });

    it("normalizes whitespace by default", async () => {
        const { container } = await render(<GtkLabel>{" Hello World "}</GtkLabel>);
        const label = await findByText(container, "Hello World");
        expect(label).toBeDefined();
    });

    it("supports custom normalizer", async () => {
        const { container } = await render(<GtkLabel>HELLO WORLD</GtkLabel>);

        const label = await findByText(container, "hello world", {
            normalizer: (text) => text.toLowerCase(),
        });

        expect(label).toBeDefined();
    });

    describe("error handling", () => {
        it("throws when text not found", async () => {
            const { container } = await render(<GtkLabel>Test</GtkLabel>);

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
        expect(buttons).toHaveLength(2);
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
                    <GtkLabel mnemonicWidget={entryRef.current}>Username</GtkLabel>
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
        await expect(findByLabelText(container, "Submit", { timeout: 100 })).rejects.toThrow();
    });
});

describe("findAllByLabelText", () => {
    it("finds all elements labeled by matching GtkLabels", async () => {
        const ref1 = { current: null as Gtk.Entry | null };
        const ref2 = { current: null as Gtk.Entry | null };

        const Form = () => (
            <VBox>
                <GtkLabel mnemonicWidget={ref1.current}>Field</GtkLabel>
                <GtkEntry
                    ref={(el) => {
                        ref1.current = el;
                    }}
                />
                <GtkLabel mnemonicWidget={ref2.current}>Field</GtkLabel>
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
        expect(entries).toHaveLength(2);
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
        expect(entries).toHaveLength(2);
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
        const { container } = await render(<GtkLabel name="title-label">Hi</GtkLabel>);
        const label = await findByName(container, "title-label");
        expect(label).toBeInstanceOf(Gtk.Label);
    });
});

describe("findByRole(LABEL)", () => {
    it("matches a GtkLabel by its accessible role", async () => {
        const { container } = await render(<GtkLabel>visible</GtkLabel>);
        const label = await findByRole(container, Gtk.AccessibleRole.LABEL, { name: "visible" });
        expect(label).toBeInstanceOf(Gtk.Label);
    });
});

describe("findByText sibling labels", () => {
    it("matches each sibling label individually, never the joined text", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel>Searching for:</GtkLabel>
                <GtkLabel>rocket</GtkLabel>
            </VBox>,
        );

        const match = await findByText(container, "rocket");
        expect(match).toBeInstanceOf(Gtk.Label);
        expect((match as Gtk.Label).getLabel()).toBe("rocket");
        expect(queryByText(container, "Searching for: rocket")).toBeNull();
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
                <GtkLabel accessibleLevel={1}>Top</GtkLabel>
                <GtkLabel accessibleLevel={2}>Section</GtkLabel>
                <GtkLabel accessibleLevel={3}>Subsection</GtkLabel>
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
        const { container } = await render(<GtkLabel accessibleLevel={2}>Heading</GtkLabel>);
        await expect(findByRole(container, Gtk.AccessibleRole.LABEL, { level: 3 })).rejects.toThrow();
    });

    it("rejects widgets that declare no accessibleLevel when one is requested", async () => {
        const { container } = await render(<GtkLabel>No level</GtkLabel>);
        await expect(findByRole(container, Gtk.AccessibleRole.LABEL, { level: 1 })).rejects.toThrow();
    });

    it("combines with name to disambiguate widgets at the same level", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel accessibleLevel={2}>First section</GtkLabel>
                <GtkLabel accessibleLevel={2}>Second section</GtkLabel>
            </VBox>,
        );

        const second = await findByRole(container, Gtk.AccessibleRole.LABEL, {
            level: 2,
            name: "Second section",
        });

        expect((second as Gtk.Label).getLabel()).toBe("Second section");
    });
});

describe("queryByRole", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkButton label="Test" />);
        const button = queryByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Test" });
        expect(button).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkLabel>Test</GtkLabel>);
        const button = queryByRole(container, Gtk.AccessibleRole.BUTTON);
        expect(button).toBeNull();
    });

    it("throws when multiple elements found", async () => {
        const { container } = await renderTwoButtons();
        expect(() => queryByRole(container, Gtk.AccessibleRole.BUTTON)).toThrow(/Found 2 elements/);
    });
});

describe("queryAllByRole", () => {
    it("returns all matching elements", async () => {
        const { container } = await renderTwoButtons();
        const buttons = queryAllByRole(container, Gtk.AccessibleRole.BUTTON);
        expect(buttons).toHaveLength(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkLabel>Test</GtkLabel>);
        const buttons = queryAllByRole(container, Gtk.AccessibleRole.BUTTON);
        expect(buttons).toEqual([]);
    });
});

describe("queryByText", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkLabel>Hello</GtkLabel>);
        const label = queryByText(container, "Hello");
        expect(label).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkLabel>Hello</GtkLabel>);
        const label = queryByText(container, "Goodbye");
        expect(label).toBeNull();
    });
});

describe("queryAllByText", () => {
    it("returns all matching elements", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkButton label="Same" />
                <GtkButton label="Same" />
            </GtkBox>,
        );

        const buttons = queryAllByText(container, "Same");
        expect(buttons).toHaveLength(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkLabel>Hello</GtkLabel>);
        const labels = queryAllByText(container, "Nonexistent");
        expect(labels).toEqual([]);
    });
});

describe("queryByName", () => {
    it("returns element when found", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = queryByName(container, "email-input");
        expect(entry).not.toBeNull();
    });

    it("returns null when not found", async () => {
        const { container } = await render(<GtkEntry name="email-input" />);
        const entry = queryByName(container, "password-input");
        expect(entry).toBeNull();
    });
});

describe("queryAllByName", () => {
    it("returns all matching elements", async () => {
        const { container } = await render(
            <GtkBox orientation={Gtk.Orientation.VERTICAL}>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </GtkBox>,
        );

        const entries = queryAllByName(container, "field");
        expect(entries).toHaveLength(2);
    });

    it("returns empty array when none found", async () => {
        const { container } = await render(<GtkEntry name="email" />);
        const entries = queryAllByName(container, "nonexistent");
        expect(entries).toEqual([]);
    });
});

describe("ByPlaceholderText", () => {
    it("queries an entry by its placeholder text", async () => {
        const { container } = await render(<GtkEntry placeholderText="Email address" />);
        const entry = queryByPlaceholderText(container, "Email address");
        expect(entry).toBeInstanceOf(Gtk.Entry);
    });

    it("returns null when no placeholder matches", async () => {
        const { container } = await render(<GtkEntry placeholderText="Email address" />);
        expect(queryByPlaceholderText(container, "Phone number")).toBeNull();
    });

    it("matches a search entry placeholder", async () => {
        const { container } = await render(<GtkSearchEntry placeholderText="Search notes" />);
        expect(getByPlaceholderText(container, "Search notes")).toBeInstanceOf(Gtk.SearchEntry);
    });

    it("supports substring matching with exact false", async () => {
        const { container } = await render(<GtkEntry placeholderText="Enter your email" />);
        expect(getByPlaceholderText(container, "your email", { exact: false })).toBeInstanceOf(Gtk.Entry);
    });

    it("supports regex matching", async () => {
        const { container } = await render(<GtkEntry placeholderText="Enter your email" />);
        expect(getByPlaceholderText(container, /email$/)).toBeInstanceOf(Gtk.Entry);
    });

    it("returns every matching entry", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry placeholderText="Field" />
                <GtkEntry placeholderText="Field" />
            </VBox>,
        );

        expect(getAllByPlaceholderText(container, "Field")).toHaveLength(2);
        expect(queryAllByPlaceholderText(container, "Missing")).toEqual([]);
    });

    it("finds an entry asynchronously", async () => {
        const { container } = await render(<GtkEntry placeholderText="Username" />);
        await expect(findByPlaceholderText(container, "Username")).resolves.toBeInstanceOf(Gtk.Entry);
        await expect(findAllByPlaceholderText(container, "Username")).resolves.toHaveLength(1);
    });

    it("throws a placeholder-formatted error when none match", async () => {
        const { container } = await render(<GtkEntry placeholderText="Present" />);

        expect(() => getByPlaceholderText(container, "Absent")).toThrow(
            /Unable to find an element with placeholder text 'Absent'/,
        );
    });
});

describe("ByDisplayValue", () => {
    it("queries an entry by its current text", async () => {
        const { container } = await render(<GtkEntry text="hello world" />);
        expect(queryByDisplayValue(container, "hello world")).toBeInstanceOf(Gtk.Entry);
    });

    it("returns null when no value matches", async () => {
        const { container } = await render(<GtkEntry text="hello world" />);
        expect(queryByDisplayValue(container, "goodbye")).toBeNull();
    });

    it("does not confuse placeholder text with display value", async () => {
        const { container } = await render(<GtkEntry placeholderText="Type here" text="actual" />);
        expect(queryByDisplayValue(container, "Type here")).toBeNull();
        expect(queryByDisplayValue(container, "actual")).toBeInstanceOf(Gtk.Entry);
    });

    it("matches a search entry value", async () => {
        const { container } = await render(<GtkSearchEntry text="query" />);
        expect(getByDisplayValue(container, "query")).toBeInstanceOf(Gtk.SearchEntry);
    });

    it("supports regex matching", async () => {
        const { container } = await render(<GtkEntry text="order-1234" />);
        expect(getByDisplayValue(container, /^order-\d+$/)).toBeInstanceOf(Gtk.Entry);
    });

    it("returns every matching widget", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry text="same" />
                <GtkEntry text="same" />
            </VBox>,
        );

        expect(getAllByDisplayValue(container, "same")).toHaveLength(2);
        expect(queryAllByDisplayValue(container, "missing")).toEqual([]);
    });

    it("finds a widget asynchronously", async () => {
        const { container } = await render(<GtkEntry text="async" />);
        await expect(findByDisplayValue(container, "async")).resolves.toBeInstanceOf(Gtk.Entry);
        await expect(findAllByDisplayValue(container, "async")).resolves.toHaveLength(1);
    });

    it("throws a display-value-formatted error when none match", async () => {
        const { container } = await render(<GtkEntry text="present" />);

        expect(() => getByDisplayValue(container, "absent")).toThrow(
            /Unable to find an element with display value 'absent'/,
        );
    });
});

describe("getByRole busy", () => {
    it("filters by busy state", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Idle" />
                <GtkButton label="Working" accessibleBusy />
            </VBox>,
        );

        const busy = queryByRole(container, Gtk.AccessibleRole.BUTTON, { busy: true });
        expect((busy as Gtk.Button).getLabel()).toBe("Working");
        expect(queryAllByRole(container, Gtk.AccessibleRole.BUTTON, { busy: false })).toHaveLength(1);
    });
});

describe("getByRole description", () => {
    it("filters by accessible description", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Save" accessibleDescription="Persist changes" />
                <GtkButton label="Cancel" accessibleDescription="Discard changes" />
            </VBox>,
        );

        const save = queryByRole(container, Gtk.AccessibleRole.BUTTON, { description: "Persist changes" });
        expect((save as Gtk.Button).getLabel()).toBe("Save");
        const discard = queryByRole(container, Gtk.AccessibleRole.BUTTON, { description: /discard/i });
        expect((discard as Gtk.Button).getLabel()).toBe("Cancel");
    });
});

describe("getByRole value", () => {
    it("filters a slider by its live adjustment value now/min/max", async () => {
        const { container } = await render(
            <VBox>
                <GtkScale adjustment={<GtkAdjustment value={25} lower={0} upper={100} />} />
                <GtkScale adjustment={<GtkAdjustment value={75} lower={0} upper={100} />} />
            </VBox>,
        );

        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { now: 25 } })).not.toBeNull();
        expect(queryAllByRole(container, Gtk.AccessibleRole.SLIDER, { value: { min: 0, max: 100 } })).toHaveLength(2);
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { now: 999 } })).toBeNull();
    });

    it("filters a progress bar by its live fraction", async () => {
        const { container } = await render(
            <VBox>
                <GtkProgressBar fraction={0.25} />
                <GtkProgressBar fraction={0.75} />
            </VBox>,
        );

        expect(queryByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { now: 0.25 } })).not.toBeNull();

        expect(queryAllByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { min: 0, max: 1 } })).toHaveLength(
            2,
        );

        expect(queryByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { now: 0.99 } })).toBeNull();
    });

    it("filters a level bar by its live value/min/max", async () => {
        const { container } = await render(<GtkLevelBar value={0.3} />);

        expect(
            queryByRole(container, Gtk.AccessibleRole.METER, { value: { now: 0.3, min: 0, max: 1 } }),
        ).not.toBeNull();

        expect(queryByRole(container, Gtk.AccessibleRole.METER, { value: { now: 0.9 } })).toBeNull();
    });

    it("falls back to author-supplied accessibleValueText alongside a live value", async () => {
        const { container } = await render(
            <GtkScale adjustment={<GtkAdjustment value={10} lower={0} upper={100} />} accessibleValueText="Loading" />,
        );

        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { text: "Loading" } })).not.toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { text: "Done" } })).toBeNull();
    });
});

describe("getByRole hidden", () => {
    it("excludes accessibility-hidden widgets by default", async () => {
        const { defaultMatches, hiddenIncludedMatches } = await queryButtonsBesideHidden(
            <GtkButton label="Hidden" accessibleHidden />,
        );

        expect(defaultMatches).toHaveLength(1);
        expect(hiddenIncludedMatches).toHaveLength(2);
    });

    it("excludes not-visible widgets by default", async () => {
        const { defaultMatches, hiddenIncludedMatches } = await queryButtonsBesideHidden(
            <GtkButton label="Gone" visible={false} />,
        );

        expect(defaultMatches).toHaveLength(1);
        expect(hiddenIncludedMatches).toHaveLength(2);
    });
});

describe("getByLabelText accessible-label and accessible-labelledby", () => {
    it("matches a widget by its own accessibleLabel", async () => {
        const { container } = await render(<GtkEntry accessibleLabel="Email address" />);
        expect(getByLabelText(container, "Email address")).toBeInstanceOf(Gtk.Entry);
    });

    it("matches a widget labeled by accessibleLabelledBy", async () => {
        const labelRef = { current: null as Gtk.Label | null };

        const Form = () => (
            <VBox>
                <GtkLabel
                    ref={(el) => {
                        labelRef.current = el;
                    }}
                >
                    Full name
                </GtkLabel>
                <GtkEntry accessibleLabelledBy={labelRef.current ? [labelRef.current] : []} />
            </VBox>
        );

        const { container, rerender } = await render(<Form />);
        await rerender(<Form />);
        expect(getByLabelText(container, "Full name")).toBeInstanceOf(Gtk.Entry);
    });
});

describe("getDefaultNormalizer", () => {
    it("trims and collapses whitespace by default", () => {
        const normalize = getDefaultNormalizer();
        expect(normalize("  hello   world  ")).toBe("hello world");
    });

    it("can leave leading and trailing whitespace intact", () => {
        const normalize = getDefaultNormalizer({ trim: false });
        expect(normalize("  hello  ")).toBe(" hello ");
    });

    it("can preserve internal whitespace runs", () => {
        const normalize = getDefaultNormalizer({ collapseWhitespace: false });
        expect(normalize("  hello   world  ")).toBe("hello   world");
    });

    it("composes inside a custom normalizer", async () => {
        const { container } = await render(<GtkLabel>HELLO WORLD</GtkLabel>);
        expect(getByText(container, "hello world", { normalizer })).toBeDefined();
    });

    it("rejects combining a custom normalizer with trim", async () => {
        const { container } = await render(<GtkLabel>hello</GtkLabel>);

        expect(() => queryByText(container, "hello", { normalizer: (text) => text, trim: true })).toThrow(
            /trim and collapseWhitespace are not supported with a normalizer/,
        );
    });

    it("rejects combining a custom normalizer with collapseWhitespace", async () => {
        const { container } = await render(<GtkLabel>hello</GtkLabel>);

        expect(() =>
            queryByText(container, "hello", { normalizer: (text) => text, collapseWhitespace: false }),
        ).toThrow(/trim and collapseWhitespace are not supported with a normalizer/);
    });

    it("accepts a custom normalizer on its own", async () => {
        const { container } = await render(<GtkLabel>hello</GtkLabel>);
        expect(queryByText(container, "HELLO", { normalizer: (text) => text.toUpperCase() })).not.toBeNull();
    });
});
