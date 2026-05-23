import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { describe, expect, it } from "vitest";
import { hypertextDemo } from "../../../src/demos/input/hypertext.js";
import { fireEvent, renderDemo, screen, waitFor } from "../../test-utils.js";

const findControllerOfType = <T extends Gtk.EventController>(
    widget: Gtk.Widget,
    ctor: new (...args: never[]) => T,
): T | null => {
    const observer = widget.observeControllers();
    const count = observer.getNItems();
    for (let i = 0; i < count; i++) {
        const controller = observer.getItem(i);
        if (controller instanceof ctor) return controller;
    }
    return null;
};

const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) ?? "";
};

const findTextView = async (): Promise<Gtk.TextView> =>
    (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;

describe("hypertextDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(hypertextDemo.id).toBe("hypertext");
        expect(hypertextDemo.title).toBe("Text View/Hypertext");
        expect(hypertextDemo.description.length).toBeGreaterThan(0);
        expect(Array.isArray(hypertextDemo.keywords)).toBe(true);
        expect(typeof hypertextDemo.sourceCode).toBe("string");
        expect(hypertextDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(hypertextDemo.defaultWidth).toBe(330);
        expect(hypertextDemo.defaultHeight).toBe(330);
        expect(hypertextDemo.component).toBeTypeOf("function");
    });
});

describe("hypertextDemo rendering", () => {
    it("renders page 1 with the hypertext and tags introduction", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        expect(textView).toBeInstanceOf(Gtk.TextView);
        expect(textView.getWrapMode()).toBe(Gtk.WrapMode.WORD);
        expect(textView.getBuffer().getEnableUndo()).toBe(true);
        const text = readBufferText(textView);
        expect(text).toContain("simple ");
        expect(text).toContain("hypertext");
        expect(text).toContain("can easily be realized with ");
        expect(text).toContain("tags");
    });

    it("registers motion, click, and key controllers on the text view", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        expect(findControllerOfType(textView, Gtk.EventControllerMotion)).toBeInstanceOf(Gtk.EventControllerMotion);
        expect(findControllerOfType(textView, Gtk.EventControllerKey)).toBeInstanceOf(Gtk.EventControllerKey);
        expect(findControllerOfType(textView, Gtk.GestureClick)).toBeInstanceOf(Gtk.GestureClick);
    });
});

describe("hypertextDemo link navigation", () => {
    it("navigates to the tags definition page when the click gesture identifies the tags link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const initial = readBufferText(textView);
        const linkText = "tags";
        const tagsOffset = initial.indexOf(linkText);
        expect(tagsOffset).toBeGreaterThan(0);
        const iter = buffer.getIterAtOffset(tagsOffset);
        buffer.placeCursor(iter);
        const keyController = findControllerOfType(textView, Gtk.EventControllerKey);
        expect(keyController).not.toBeNull();
        await fireEvent(keyController as Gtk.EventControllerKey, "key-pressed", Gdk.KEY_Return, 0, 0);
        const after = readBufferText(textView);
        expect(after).toContain("attribute that can be applied to some range of text");
    });

    it("navigates to the hypertext definition page when the hypertext link is activated", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const initial = readBufferText(textView);
        const linkOffset = initial.indexOf("hypertext");
        expect(linkOffset).toBeGreaterThan(0);
        buffer.placeCursor(buffer.getIterAtOffset(linkOffset));
        const keyController = findControllerOfType(textView, Gtk.EventControllerKey);
        await fireEvent(keyController as Gtk.EventControllerKey, "key-pressed", Gdk.KEY_KP_Enter, 0, 0);
        const after = readBufferText(textView);
        expect(after).toContain("Machine-readable text that is not sequential");
    });
});

describe("hypertextDemo round trip", () => {
    it("navigates from page 2 (tags) back to page 1 via the Go back link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const initial = readBufferText(textView);
        const tagsOffset = initial.indexOf("tags");
        textView.getBuffer().placeCursor(textView.getBuffer().getIterAtOffset(tagsOffset));
        const firstController = findControllerOfType(textView, Gtk.EventControllerKey) as Gtk.EventControllerKey;
        await fireEvent(firstController, "key-pressed", Gdk.KEY_Return, 0, 0);
        const pageTwo = await waitFor(() => {
            const text = readBufferText(textView);
            expect(text).toContain("attribute that can be applied");
            return text;
        });
        const backOffset = pageTwo.indexOf("Go back");
        expect(backOffset).toBeGreaterThanOrEqual(0);
        const bufferAfter = textView.getBuffer();
        bufferAfter.placeCursor(bufferAfter.getIterAtOffset(backOffset + 1));
        const secondController = findControllerOfType(textView, Gtk.EventControllerKey) as Gtk.EventControllerKey;
        await fireEvent(secondController, "key-pressed", Gdk.KEY_Return, 0, 0);
        await waitFor(() => {
            const finalText = readBufferText(textView);
            const isBackOnPageOne =
                finalText.includes("can easily be realized with ") || finalText.includes("Some text to show");
            expect(isBackOnPageOne).toBe(true);
        });
    });
});

describe("hypertextDemo input edge cases", () => {
    it("ignores non-Enter key presses without changing the page", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const beforeText = readBufferText(textView);
        const keyController = findControllerOfType(textView, Gtk.EventControllerKey) as Gtk.EventControllerKey;
        await fireEvent(keyController, "key-pressed", Gdk.KEY_a, 0, 0);
        expect(readBufferText(textView)).toBe(beforeText);
    });

    it("does not navigate via Enter when the cursor is not on a link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        buffer.placeCursor(buffer.getStartIter());
        const keyController = findControllerOfType(textView, Gtk.EventControllerKey) as Gtk.EventControllerKey;
        const beforeText = readBufferText(textView);
        await fireEvent(keyController, "key-pressed", Gdk.KEY_Return, 0, 0);
        expect(readBufferText(textView)).toBe(beforeText);
    });

    it("invokes the motion handler without throwing for both link and non-link positions", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const motion = findControllerOfType(textView, Gtk.EventControllerMotion) as Gtk.EventControllerMotion;
        await fireEvent(motion, "motion", 1, 1);
        await fireEvent(motion, "motion", 10_000, 10_000);
        expect(readBufferText(textView)).toContain("hypertext");
    });

    it("invokes the click handler at out-of-range coordinates without changing the page", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const before = readBufferText(textView);
        const click = findControllerOfType(textView, Gtk.GestureClick) as Gtk.GestureClick;
        await fireEvent(click, "released", 1, 999_999, 999_999);
        expect(readBufferText(textView)).toBe(before);
    });
});
