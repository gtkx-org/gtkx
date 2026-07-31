import * as Gtk from "@gtkx/gi/gtk";
import { type RenderResult, screen, userEvent, waitFor, within } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { textviewDemo } from "../../../src/demos/input/textview.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

const FORMATTING_TAGS = [
    "italic",
    "bold",
    "monospace",
    "blue_foreground",
    "red_background",
    "strikethrough",
    "underline",
    "double_underline",
    "superscript",
    "subscript",
    "center",
    "right_justify",
    "not_editable",
    "word_wrap",
    "char_wrap",
    "no_wrap",
];

const findTextViews = async (): Promise<[Gtk.TextView, Gtk.TextView]> => {
    const view1 = await screen.findByName("text-view-1", { as: Gtk.TextView });
    const view2 = await screen.findByName("text-view-2", { as: Gtk.TextView });

    return [view1, view2];
};

const findClickMeButtons = async (): Promise<Gtk.Button[]> =>
    screen.findAllByRole(Gtk.AccessibleRole.BUTTON, { name: "Click Me", as: Gtk.Button });

const findComboBoxes = (): Gtk.DropDown[] =>
    screen.queryAllByRole(Gtk.AccessibleRole.COMBO_BOX, { as: Gtk.DropDown });

const findScales = (): Gtk.Scale[] => screen.queryAllByRole(Gtk.AccessibleRole.SLIDER, { as: Gtk.Scale });
const findEntries = (): Gtk.Entry[] => screen.queryAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.Entry });

const enclosingTextViewName = (widget: Gtk.Widget): string | null => {
    let cur: Gtk.Widget | null = widget;

    while (cur) {
        if (cur instanceof Gtk.TextView) {
            return cur.getName();
        }

        cur = cur.getParent();
    }

    return null;
};

const getBuffer = (view: Gtk.TextView): Gtk.TextBuffer => view.getBuffer();
const getOffset = (view: Gtk.TextView, substring: string): number => readBufferText(view).indexOf(substring);

const countEmbeddedContent = (buffer: Gtk.TextBuffer): { paintables: number; anchors: number } => {
    const iter = buffer.getStartIter();
    let paintables = 0;
    let anchors = 0;

    do {
        if (iter.getPaintable()) {
            paintables++;
        }

        if (iter.getChildAnchor()) {
            anchors++;
        }
    } while (iter.forwardChar());

    return { paintables, anchors };
};

const iterAtOffset = (buffer: Gtk.TextBuffer, offset: number): Gtk.TextIter => {
    const iter = buffer.getStartIter();
    iter.forwardChars(offset);

    return iter;
};

const openEasterEggFromClonedButton = async (): Promise<{
    result: RenderResult;
    beforeWindows: Gtk.Widget[];
    newWindow: Gtk.Window;
}> => {
    const result = await renderDemo(textviewDemo);
    const buttons = await findClickMeButtons();
    const cloned = buttons.at(-1) as Gtk.Button;
    const beforeWindows = screen.queryAllByRole(Gtk.AccessibleRole.WINDOW);
    await userEvent.click(cloned);

    await waitFor(() => {
        expect(screen.queryAllByRole(Gtk.AccessibleRole.WINDOW).length).toBeGreaterThan(beforeWindows.length);
    });

    const after = screen.queryAllByRole(Gtk.AccessibleRole.WINDOW, { as: Gtk.Window });
    const newWindow = after.find((w) => !beforeWindows.includes(w));

    if (!newWindow) {
        throw new Error("easter-egg window not found");
    }

    return { result, beforeWindows, newWindow };
};

describe("textviewDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(textviewDemo.id).toBe("textview");
        expect(textviewDemo.title).toBe("Text View/Multiple Views");
        expect(textviewDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(textviewDemo.keywords)).toBe(true);
        expect(typeof textviewDemo.sourceCode).toBe("string");
        expect(textviewDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(textviewDemo.defaultWidth).toBe(450);
        expect(textviewDemo.defaultHeight).toBe(450);
        expect(textviewDemo.component).toBeTypeOf("function");
    });
});

describe("textviewDemo rendering", () => {
    it("renders two text views sharing a single buffer", async () => {
        await renderDemo(textviewDemo);
        await screen.findByRole(Gtk.AccessibleRole.WINDOW);
        const [view1, view2] = await findTextViews();
        expect(view1).toHaveObjectProperty("buffer", view2.getBuffer());
    });

    it("populates the shared buffer with section headings and international content", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const text = readBufferText(view1);
        expect(text).toContain("The text widget can display text with all kinds of nifty attributes");
        expect(text).toContain("Font styles.");
        expect(text).toContain("Colors.");
        expect(text).toContain("Underline, strikethrough, and rise.");
        expect(text).toContain("Images.");
        expect(text).toContain("Spacing.");
        expect(text).toContain("Editability.");
        expect(text).toContain("Wrapping.");
        expect(text).toContain("Justification.");
        expect(text).toContain("Internationalization.");
        expect(text).toContain("Grüß Gott");
        expect(text).toContain("Γειά σας");
    });

    it("sets word wrap mode on both reconciled text views", async () => {
        await renderDemo(textviewDemo);
        const [view1, view2] = await findTextViews();
        expect(view1).toHaveObjectProperty("wrapMode", Gtk.WrapMode.WORD);
        expect(view2).toHaveObjectProperty("wrapMode", Gtk.WrapMode.WORD);
    });
});

describe("textviewDemo formatting tags", () => {
    it("registers the demo's named formatting tags in the shared tag table", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const table = getBuffer(view1).getTagTable();

        for (const name of FORMATTING_TAGS) {
            expect(table.lookup(name)).not.toBeNull();
        }
    });

    it("applies the italic, bold and monospace tags to their respective text ranges", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const buffer = getBuffer(view1);
        const table = buffer.getTagTable();

        const cases: [string, string][] = [
            ["italic", "italic"],
            ["bold", "bold"],
            ["monospace", "monospace (typewriter)"],
        ];

        for (const [tagName, phrase] of cases) {
            const tag = table.lookup(tagName);
            expect(tag).not.toBeNull();
            const iter = iterAtOffset(buffer, getOffset(view1, phrase));
            expect(iter.hasTag(tag as Gtk.TextTag)).toBe(true);
        }
    });

    it("carries distinct per-tag wrap modes on the tagged wrapping sections", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const table = getBuffer(view1).getTagTable();
        expect(table.lookup("word_wrap") as Gtk.TextTag).toHaveObjectProperty("wrapMode", Gtk.WrapMode.WORD);
        expect(table.lookup("char_wrap") as Gtk.TextTag).toHaveObjectProperty("wrapMode", Gtk.WrapMode.CHAR);
        expect(table.lookup("no_wrap") as Gtk.TextTag).toHaveObjectProperty("wrapMode", Gtk.WrapMode.NONE);
    });
});

describe("textviewDemo embedded content", () => {
    it("embeds two paintables and four child anchors in the buffer", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const { paintables, anchors } = countEmbeddedContent(getBuffer(view1));
        expect(paintables).toBe(2);
        expect(anchors).toBe(4);
    });

    it("rejects user edits inside the not_editable range but accepts them elsewhere", async () => {
        await renderDemo(textviewDemo);
        const [view1] = await findTextViews();
        const buffer = getBuffer(view1);
        const lockedBefore = readBufferText(view1);
        buffer.placeCursor(iterAtOffset(buffer, getOffset(view1, "locked down")));
        await userEvent.type(view1, "X");
        expect(readBufferText(view1)).toBe(lockedBefore);
        const editableBefore = readBufferText(view1);
        buffer.placeCursor(buffer.getStartIter());
        await userEvent.type(view1, "Z");
        expect(readBufferText(view1)).toHaveLength(editableBefore.length + 1);
        expect(readBufferText(view1).startsWith("Z")).toBe(true);
    });
});

describe("textviewDemo cloned widgets", () => {
    it("attaches exactly one Click Me button to each text view", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        expect(buttons).toHaveLength(2);
        expect(enclosingTextViewName(buttons[0] as Gtk.Button)).toBe("text-view-1");
        expect(enclosingTextViewName(buttons.at(-1) as Gtk.Button)).toBe("text-view-2");
    });

    it("clones the dropdown, scale and entry so each widget appears twice", async () => {
        await renderDemo(textviewDemo);
        await findTextViews();
        expect(findComboBoxes()).toHaveLength(2);
        expect(findScales()).toHaveLength(2);
        expect(findEntries()).toHaveLength(2);
    });

    it("changes the embedded dropdown selection when an option is chosen", async () => {
        await renderDemo(textviewDemo);
        await findTextViews();
        const [primary, clone] = findComboBoxes();
        await userEvent.selectOptions(primary as Gtk.DropDown, 2);
        expect(primary as Gtk.DropDown).toHaveObjectProperty("selected", 2);
        await userEvent.selectOptions(clone as Gtk.DropDown, 1);
        expect(clone as Gtk.DropDown).toHaveObjectProperty("selected", 1);
    });

    it("moves the embedded scale to its adjustment bounds via keyboard stepping", async () => {
        await renderDemo(textviewDemo);
        await findTextViews();
        const scale = findScales()[0] as Gtk.Scale;
        expect(scale.getAdjustment()).toHaveObjectProperty("value", 0);
        scale.grabFocus();
        await userEvent.keyboard(scale, "{End}");
        expect(scale.getAdjustment()).toHaveObjectProperty("value", 100);
        await userEvent.keyboard(scale, "{Home}");
        expect(scale.getAdjustment()).toHaveObjectProperty("value", 0);
    });

    it("accepts typed text in the embedded and cloned entries", async () => {
        await renderDemo(textviewDemo);
        await findTextViews();
        const [primary, clone] = findEntries();
        await userEvent.type(primary as Gtk.Entry, "primary");
        expect(primary as Gtk.Entry).toHaveDisplayValue("primary");
        await userEvent.type(clone as Gtk.Entry, "clone");
        expect(clone as Gtk.Entry).toHaveDisplayValue("clone");
    });
});

describe("textviewDemo easter egg", () => {
    it("opens the easter-egg nested window when the cloned Click Me button is activated", async () => {
        const { newWindow } = await openEasterEggFromClonedButton();
        expect(newWindow).toBeInstanceOf(Gtk.Window);
    });

    it("opens the easter-egg via the source Click Me button in the first text view", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        const source = buttons[0] as Gtk.Button;
        const beforeWindows = screen.queryAllByRole(Gtk.AccessibleRole.WINDOW).length;
        await userEvent.click(source);

        await waitFor(() => {
            expect(screen.queryAllByRole(Gtk.AccessibleRole.WINDOW).length).toBeGreaterThan(beforeWindows);
        });
    });

    it("makes the easter-egg window modal and transient for the demo root window", async () => {
        const { newWindow } = await openEasterEggFromClonedButton();
        expect(newWindow).toHaveObjectProperty("modal", true);
        expect(newWindow.getTransientFor()).toBeInstanceOf(Gtk.Window);
    });

    it("nests multiple text views inside the easter-egg window sharing one buffer", async () => {
        const { newWindow } = await openEasterEggFromClonedButton();
        const nested = within(newWindow).queryAllByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });
        expect(nested.length).toBeGreaterThan(1);
        const sharedBuffer = nested[0]?.getBuffer();

        for (const view of nested) {
            expect(view).toHaveObjectProperty("buffer", sharedBuffer);
        }
    });

    it("reuses the same easter-egg window on subsequent activations", async () => {
        await renderDemo(textviewDemo);
        const buttons = await findClickMeButtons();
        const cloned = buttons.at(-1) as Gtk.Button;
        const beforeCount = screen.queryAllByRole(Gtk.AccessibleRole.WINDOW).length;
        await userEvent.dblClick(cloned);

        await waitFor(() => {
            expect(screen.queryAllByRole(Gtk.AccessibleRole.WINDOW)).toHaveLength(beforeCount + 1);
        });
    });

    it("destroys the easter-egg window when the demo unmounts", async () => {
        const { result, newWindow } = await openEasterEggFromClonedButton();
        expect(screen.queryAllByRole(Gtk.AccessibleRole.WINDOW)).toContain(newWindow);
        await result.unmount();
        expect(screen.queryAllByRole(Gtk.AccessibleRole.WINDOW)).not.toContain(newWindow);
    });
});
