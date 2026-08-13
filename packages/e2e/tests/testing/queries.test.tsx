import type { ReactNode } from "react";
import * as Gtk from "@gtkx/gi/gtk";
import {
    GtkAdjustment,
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkEntry,
    GtkExpander,
    GtkFrame,
    GtkLabel,
    GtkLevelBar,
    GtkProgressBar,
    GtkScale,
    GtkSearchEntry,
    GtkSwitch,
    GtkToggleButton,
} from "@gtkx/jsx/gtk";
import {
    cleanup,
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
    screen,
    within,
} from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { VBox } from "./widget-fixtures.js";

type LabelledRefs = {
    first: Gtk.Entry | null;
    second: Gtk.Entry | null;
    labelled: Gtk.Entry | null;
    label: Gtk.Label | null;
};

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

const toLowercase = (text: string): string => getDefaultNormalizer()(text).toLowerCase();

const renderTwoButtons = () =>
    render(
        <VBox>
            <GtkButton label="Same" />
            <GtkButton label="Same" />
        </VBox>,
    );

describe("ByRole (1)", () => {
    it("matches a role, and narrows it by name, level, description and busy state", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton label="Save" accessibleDescription="Persist changes" />
                <GtkButton label="Working" accessibleBusy />
                <GtkLabel accessibleLevel={2}>Section</GtkLabel>
                <GtkLabel accessibleLevel={3}>Subsection</GtkLabel>
            </VBox>,
        );

        const save = await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Save" });
        expect(save).toHaveTextContent("Save");
        expect(await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: /^sav/i })).toBe(save);

        expect(await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: (text) => text.includes("Sav") })).toBe(
            save,
        );

        expect(queryByRole(container, Gtk.AccessibleRole.BUTTON, { description: /persist/i })).toBe(save);
        expect(queryByRole(container, Gtk.AccessibleRole.BUTTON, { busy: true })).toHaveTextContent("Working");
        expect(queryAllByRole(container, Gtk.AccessibleRole.BUTTON, { busy: false })).toEqual([save]);
        const section = await findByRole(container, Gtk.AccessibleRole.LABEL, { level: 2, name: "Section" });
        expect(section).toHaveTextContent("Section");
        expect(queryByRole(container, Gtk.AccessibleRole.LABEL, { level: 9 })).toBeNull();
    });

    it("narrows by checked and pressed state across checkboxes, switches and toggles", async () => {
        const { container } = await render(
            <VBox>
                <GtkCheckButton label="Unchecked" />
                <GtkCheckButton label="Checked" active />
                <GtkSwitch />
                <GtkSwitch active />
                <GtkToggleButton label="Inactive" />
                <GtkToggleButton label="Active" active />
                <GtkExpander label="Expanded" expanded>
                    <GtkLabel>Content</GtkLabel>
                </GtkExpander>
            </VBox>,
        );

        expect(await findByRole(container, Gtk.AccessibleRole.CHECKBOX, { checked: true })).toBeChecked();
        expect(await findByRole(container, Gtk.AccessibleRole.SWITCH, { checked: true })).toBeChecked();
        expect(await findByRole(container, Gtk.AccessibleRole.TOGGLE_BUTTON, { pressed: true })).toBePressed();

        expect(await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Expanded" })).toHaveAccessibleState(
            Gtk.AccessibleState.EXPANDED,
            true,
        );
    });
});

describe("ByRole (2)", () => {
    it("narrows sliders, progress bars and level bars by their live value", async () => {
        const { container } = await render(
            <VBox>
                <GtkScale adjustment={<GtkAdjustment value={25} lower={0} upper={100} />} accessibleValueText="Load" />
                <GtkScale adjustment={<GtkAdjustment value={75} lower={0} upper={100} />} />
                <GtkProgressBar fraction={0.25} />
                <GtkLevelBar value={0.3} />
            </VBox>,
        );

        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { now: 25 } })).not.toBeNull();
        expect(queryAllByRole(container, Gtk.AccessibleRole.SLIDER, { value: { min: 0, max: 100 } })).toHaveLength(2);
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { now: 999 } })).toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { text: "Load" } })).not.toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.SLIDER, { value: { text: "Done" } })).toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.PROGRESS_BAR, { value: { now: 0.25 } })).not.toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.METER, { value: { now: 0.3, min: 0 } })).not.toBeNull();
        expect(queryByRole(container, Gtk.AccessibleRole.METER, { value: { now: 0.9 } })).toBeNull();
    });

    it("names a widget from the label GTK relates it to, ahead of an authored accessibleLabel", async () => {
        const { container } = await render(
            <VBox>
                <GtkButton accessibleLabel="Submit form" label="OK" />
                <GtkButton accessibleLabel="Close dialog" iconName="window-close-symbolic" />
                <GtkBox accessibleLabel="A group" accessibleRole={Gtk.AccessibleRole.GROUP} />
                <GtkLabel>visible</GtkLabel>
            </VBox>,
        );

        expect(await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "OK" })).toHaveTextContent("OK");

        expect(await findByRole(container, Gtk.AccessibleRole.BUTTON, { name: "Close dialog" })).toHaveObjectProperty(
            "icon-name",
            "window-close-symbolic",
        );

        expect(await findByRole(container, Gtk.AccessibleRole.GROUP, { name: "A group" })).toBeEmptyWidget();
        expect(await findByRole(container, Gtk.AccessibleRole.LABEL, { name: "visible" })).toHaveTextContent("visible");
    });
});

describe("ByRole (3)", () => {
    it("skips accessibility-hidden widgets by default and never-mapped ones either way", async () => {
        const hidden = await queryButtonsBesideHidden(<GtkButton label="Hidden" accessibleHidden />);
        expect(hidden.defaultMatches).toHaveLength(1);
        expect(hidden.hiddenIncludedMatches).toHaveLength(2);
        const invisible = await queryButtonsBesideHidden(<GtkButton label="Gone" visible={false} />);
        expect(invisible.defaultMatches).toHaveLength(1);
        expect(invisible.hiddenIncludedMatches).toHaveLength(1);
    });

    it("throws when nothing matches, and when more than one does", async () => {
        const { container } = await renderTwoButtons();
        await expect(findByRole(container, Gtk.AccessibleRole.SLIDER, { timeout: 100 })).rejects.toThrow();
        await expect(findAllByRole(container, Gtk.AccessibleRole.SLIDER, { timeout: 100 })).rejects.toThrow();
        expect(() => queryByRole(container, Gtk.AccessibleRole.BUTTON)).toThrow();
    });
});

describe("ByText", () => {
    it("matches exact, partial, whitespace-normalized and custom-normalized text", async () => {
        const { container } = await render(<GtkLabel>{" Hello World "}</GtkLabel>);
        const label = await findByText(container, "Hello World");
        expect(label).toHaveTextContent("Hello World");
        expect(await findByText(container, "Hello", { exact: false })).toBe(label);
        expect(getByText(container, "hello world", { normalizer: toLowercase })).toBe(label);
        expect(queryByText(container, "Goodbye")).toBeNull();
    });

    it("matches each sibling label individually, never the joined text", async () => {
        const { container } = await render(
            <VBox>
                <GtkLabel>Searching for:</GtkLabel>
                <GtkLabel>rocket</GtkLabel>
            </VBox>,
        );

        const match = await findByText(container, "rocket");
        expect(match).toHaveTextContent(/^rocket$/);
        expect(queryByText(container, "Searching for: rocket")).toBeNull();
    });

    it("returns every match, an empty list when there is none, and throws on ambiguity", async () => {
        const { container } = await renderTwoButtons();
        expect(await findAllByText(container, "Same")).toHaveLength(2);
        expect(queryAllByText(container, "Same")).toHaveLength(2);
        expect(queryAllByText(container, "Nonexistent")).toEqual([]);
        await expect(findByText(container, "Same", { timeout: 100 })).rejects.toThrow();
        await expect(findByText(container, "Nonexistent", { timeout: 100 })).rejects.toThrow();
    });
});

describe("ByName", () => {
    it("matches a widget of any kind by its widget name, exactly or by pattern", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry name="form-field-email" />
                <GtkLabel name="title-label">Hi</GtkLabel>
            </VBox>,
        );

        const entry = await findByName(container, "form-field-email");
        expect(entry).toHaveRole(Gtk.AccessibleRole.TEXT_BOX);
        expect(await findByName(container, /form-field/)).toBe(entry);
        expect(await findByName(container, "title-label")).toHaveTextContent("Hi");
        expect(queryByName(container, "password-input")).toBeNull();
    });

    it("returns every match, an empty list when there is none, and throws when nothing matches", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry name="field" />
                <GtkEntry name="field" />
            </VBox>,
        );

        expect(await findAllByName(container, "field")).toHaveLength(2);
        expect(queryAllByName(container, "field")).toHaveLength(2);
        expect(queryAllByName(container, "nonexistent")).toEqual([]);
        await expect(findByName(container, "missing", { timeout: 100 })).rejects.toThrow();
        await expect(findByName(container, /^missing/, { timeout: 100 })).rejects.toThrow();
    });
});

describe("ByLabelText", () => {
    it("matches through a label's mnemonic widget, an accessibleLabel and accessibleLabelledBy", async () => {
        const refs: LabelledRefs = { first: null, second: null, labelled: null, label: null };

        const Form = (): ReactNode => (
            <VBox>
                <GtkLabel mnemonicWidget={refs.first}>Field</GtkLabel>
                <GtkEntry
                    ref={(entry) => {
                        refs.first = entry;
                    }}
                />
                <GtkLabel mnemonicWidget={refs.second}>Field</GtkLabel>
                <GtkEntry
                    ref={(entry) => {
                        refs.second = entry;
                    }}
                />
                <GtkLabel
                    ref={(label) => {
                        refs.label = label;
                    }}
                >
                    Full name
                </GtkLabel>
                <GtkEntry
                    ref={(entry) => {
                        refs.labelled = entry;
                    }}
                    accessibleLabelledBy={refs.label ? [refs.label] : []}
                />
                <GtkEntry accessibleLabel="Email address" />
            </VBox>
        );

        const { container, rerender } = await render(<Form />);
        await rerender(<Form />);
        expect(await findByLabelText(container, "Full name")).toBe(refs.labelled);
        expect(await findAllByLabelText(container, "Field")).toEqual([refs.first, refs.second]);
        expect(getByLabelText(container, "Email address")).toHaveAccessibleName("Email address");
    });

    it("throws when no association exists", async () => {
        const { container } = await render(<GtkButton label="Submit" />);
        await expect(findByLabelText(container, "Submit", { timeout: 100 })).rejects.toThrow();
    });
});

describe("ByPlaceholderText", () => {
    it("matches an entry exactly, by substring and by pattern, and every one of them", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry placeholderText="Enter your email" />
                <GtkSearchEntry placeholderText="Search notes" />
                <GtkEntry placeholderText="Search notes" />
            </VBox>,
        );

        const email = queryByPlaceholderText(container, "Enter your email");
        expect(email).toHaveObjectProperty("placeholder-text", "Enter your email");
        expect(getByPlaceholderText(container, "your email", { exact: false })).toBe(email);
        expect(getByPlaceholderText(container, /email$/)).toBe(email);
        expect(getAllByPlaceholderText(container, "Search notes")).toHaveLength(2);
        expect(await findByPlaceholderText(container, "Enter your email")).toBe(email);
        expect(await findAllByPlaceholderText(container, "Search notes")).toHaveLength(2);
    });

    it("reports nothing, and the get variant throws, when no placeholder matches", async () => {
        const { container } = await render(<GtkEntry placeholderText="Present" />);
        expect(queryByPlaceholderText(container, "Absent")).toBeNull();
        expect(queryAllByPlaceholderText(container, "Absent")).toEqual([]);
        expect(() => getByPlaceholderText(container, "Absent")).toThrow();
    });
});

describe("ByDisplayValue", () => {
    it("matches an entry's current text, never its placeholder, exactly or by pattern", async () => {
        const { container } = await render(
            <VBox>
                <GtkEntry placeholderText="Type here" text="order-1234" />
                <GtkSearchEntry text="same" />
                <GtkEntry text="same" />
            </VBox>,
        );

        const order = queryByDisplayValue(container, "order-1234");
        expect(order).toHaveDisplayValue("order-1234");
        expect(queryByDisplayValue(container, "Type here")).toBeNull();
        expect(getByDisplayValue(container, /^order-\d+$/)).toBe(order);
        expect(getAllByDisplayValue(container, "same")).toHaveLength(2);
        expect(await findByDisplayValue(container, "order-1234")).toBe(order);
        expect(await findAllByDisplayValue(container, "same")).toHaveLength(2);
    });

    it("reports nothing, and the get variant throws, when no value matches", async () => {
        const { container } = await render(<GtkEntry text="present" />);
        expect(queryByDisplayValue(container, "absent")).toBeNull();
        expect(queryAllByDisplayValue(container, "absent")).toEqual([]);
        expect(() => getByDisplayValue(container, "absent")).toThrow();
    });
});

describe("getDefaultNormalizer", () => {
    it("trims and collapses whitespace, and each can be turned off", () => {
        expect(getDefaultNormalizer()("  hello   world  ")).toBe("hello world");
        expect(getDefaultNormalizer({ trim: false })("  hello  ")).toBe(" hello ");
        expect(getDefaultNormalizer({ collapseWhitespace: false })("  hello   world  ")).toBe("hello   world");
    });

    it("accepts a custom normalizer on its own, and throws when it is combined with the flags", async () => {
        const { container } = await render(<GtkLabel>hello</GtkLabel>);
        expect(queryByText(container, "HELLO", { normalizer: (text) => text.toUpperCase() })).not.toBeNull();
        expect(() => queryByText(container, "hello", { normalizer: (text) => text, trim: true })).toThrow();

        expect(() =>
            queryByText(container, "hello", { normalizer: (text) => text, collapseWhitespace: false }),
        ).toThrow();
    });
});

describe("screen", () => {
    it("routes queries through the global toplevel scope", async () => {
        await render(
            <VBox>
                <GtkButton label="First" />
                <GtkButton label="Second" />
            </VBox>,
        );

        expect(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "First" })).toHaveTextContent("First");
        expect(await screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: /First|Second/ })).toHaveLength(2);
    });

    it("throws when no render has been performed", async () => {
        await cleanup();
        expect(() => screen.findByRole(Gtk.AccessibleRole.BUTTON, { timeout: 100 })).toThrow();
    });
});

describe("within", () => {
    it("scopes the whole bound-query surface to the container, and nests", async () => {
        await render(
            <VBox>
                <GtkFrame name="outer-frame" label="Section A">
                    <GtkFrame name="inner-frame">
                        <VBox>
                            <GtkButton label="Submit" />
                            <GtkButton label="Submit" />
                        </VBox>
                    </GtkFrame>
                </GtkFrame>
                <GtkLabel>Outside</GtkLabel>
            </VBox>,
        );

        const outer = await screen.findByName("outer-frame");
        const inner = await within(outer).findByName("inner-frame");
        const bound = within(inner);
        expect(await bound.findAllByText("Submit")).toHaveLength(2);
        expect(typeof bound.queryByRole).toBe("function");
        expect(typeof bound.queryAllByName).toBe("function");
        await expect(bound.findByText("Outside", { timeout: 100 })).rejects.toThrow();
    });
});
