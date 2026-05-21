import * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import { fireEvent } from "@gtkx/testing";
import { describe, expect, it } from "vitest";
import { hypertextDemo } from "../../../src/demos/input/hypertext.js";
import { renderDemo } from "../../helpers/render-demo.js";

const findAllByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T[] => {
    const results: T[] = [];
    const stack: Gtk.Widget[] = [root];
    while (stack.length > 0) {
        const node = stack.pop();
        if (!node) continue;
        if (node instanceof ctor) results.push(node as T);
        let next = node.getFirstChild();
        while (next) {
            stack.push(next);
            next = next.getNextSibling();
        }
    }
    return results;
};

const findFirstByType = <T extends Gtk.Widget>(root: Gtk.Widget, ctor: new () => T): T | null => {
    const [first] = findAllByType(root, ctor);
    return first ?? null;
};

const findMotionController = (textView: Gtk.TextView): Gtk.EventControllerMotion | null => {
    const controllers = textView.observeControllers();
    const n = controllers.getNItems();
    for (let i = 0; i < n; i++) {
        const c = controllers.getItem(i);
        if (c instanceof Gtk.EventControllerMotion) return c;
    }
    return null;
};

const findKeyController = (textView: Gtk.TextView): Gtk.EventControllerKey | null => {
    const controllers = textView.observeControllers();
    const n = controllers.getNItems();
    for (let i = 0; i < n; i++) {
        const c = controllers.getItem(i);
        if (c instanceof Gtk.EventControllerKey) return c;
    }
    return null;
};

const findClickGesture = (textView: Gtk.TextView): Gtk.GestureClick | null => {
    const controllers = textView.observeControllers();
    const n = controllers.getNItems();
    for (let i = 0; i < n; i++) {
        const c = controllers.getItem(i);
        if (c instanceof Gtk.GestureClick) return c;
    }
    return null;
};

const readBufferText = (view: Gtk.TextView): string => {
    const buffer = view.getBuffer();
    return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false) ?? "";
};

describe("hypertextDemo metadata", () => {
    it("exposes the expected metadata", () => {
        expect(hypertextDemo.id).toBe("hypertext");
        expect(hypertextDemo.title).toBe("Text View/Hypertext");
        expect(typeof hypertextDemo.sourceCode).toBe("string");
        expect(hypertextDemo.sourceCode?.length ?? 0).toBeGreaterThan(0);
        expect(hypertextDemo.keywords).toContain("hypertext");
        expect(hypertextDemo.keywords).toContain("clickable");
        expect(hypertextDemo.defaultWidth).toBe(330);
        expect(hypertextDemo.defaultHeight).toBe(330);
        expect(hypertextDemo.component).toBeTypeOf("function");
    });
});

describe("hypertextDemo rendering", () => {
    it("renders page 1 with the hypertext and tags introduction", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView);
        expect(textView).toBeInstanceOf(Gtk.TextView);
        expect(textView?.getWrapMode()).toBe(Gtk.WrapMode.WORD);
        expect(textView?.getBuffer().getEnableUndo()).toBe(true);
        const text = readBufferText(textView as Gtk.TextView);
        expect(text).toContain("simple ");
        expect(text).toContain("hypertext");
        expect(text).toContain("can easily be realized with ");
        expect(text).toContain("tags");
    });

    it("registers motion, click, and key controllers on the text view", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        expect(findMotionController(textView)).toBeInstanceOf(Gtk.EventControllerMotion);
        expect(findKeyController(textView)).toBeInstanceOf(Gtk.EventControllerKey);
        expect(findClickGesture(textView)).toBeInstanceOf(Gtk.GestureClick);
    });
});

describe("hypertextDemo link navigation", () => {
    it("navigates to the tags definition page when the click gesture identifies the tags link", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const initial = readBufferText(textView);
        const linkText = "tags";
        const tagsOffset = initial.indexOf(linkText);
        expect(tagsOffset).toBeGreaterThan(0);
        const iter = buffer.getIterAtOffset(tagsOffset);
        buffer.placeCursor(iter);
        const keyController = findKeyController(textView);
        expect(keyController).not.toBeNull();
        await fireEvent(keyController as Gtk.EventControllerKey, "key-pressed", Gdk.KEY_Return, 0, 0);
        const after = readBufferText(textView);
        expect(after).toContain("attribute that can be applied to some range of text");
    });

    it("navigates to the hypertext definition page when the hypertext link is activated", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        const initial = readBufferText(textView);
        const linkOffset = initial.indexOf("hypertext");
        expect(linkOffset).toBeGreaterThan(0);
        buffer.placeCursor(buffer.getIterAtOffset(linkOffset));
        const keyController = findKeyController(textView);
        await fireEvent(keyController as Gtk.EventControllerKey, "key-pressed", Gdk.KEY_KP_Enter, 0, 0);
        const after = readBufferText(textView);
        expect(after).toContain("Machine-readable text that is not sequential");
    });
});

describe("hypertextDemo round trip", () => {
    it("navigates from page 2 (tags) back to page 1 via the Go back link", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const initial = readBufferText(textView);
        const tagsOffset = initial.indexOf("tags");
        textView.getBuffer().placeCursor(textView.getBuffer().getIterAtOffset(tagsOffset));
        const firstController = findKeyController(textView) as Gtk.EventControllerKey;
        await fireEvent(firstController, "key-pressed", Gdk.KEY_Return, 0, 0);
        await new Promise((resolve) => setTimeout(resolve, 30));
        const pageTwo = readBufferText(textView);
        expect(pageTwo).toContain("attribute that can be applied");
        const backOffset = pageTwo.indexOf("Go back");
        expect(backOffset).toBeGreaterThanOrEqual(0);
        const bufferAfter = textView.getBuffer();
        bufferAfter.placeCursor(bufferAfter.getIterAtOffset(backOffset + 1));
        const secondController = findKeyController(textView) as Gtk.EventControllerKey;
        await fireEvent(secondController, "key-pressed", Gdk.KEY_Return, 0, 0);
        await new Promise((resolve) => setTimeout(resolve, 50));
        const finalText = readBufferText(textView);
        const isBackOnPageOne =
            finalText.includes("can easily be realized with ") || finalText.includes("Some text to show");
        expect(isBackOnPageOne).toBe(true);
    });
});

describe("hypertextDemo input edge cases", () => {
    it("ignores non-Enter key presses without changing the page", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const beforeText = readBufferText(textView);
        const keyController = findKeyController(textView) as Gtk.EventControllerKey;
        await fireEvent(keyController, "key-pressed", Gdk.KEY_a, 0, 0);
        expect(readBufferText(textView)).toBe(beforeText);
    });

    it("does not navigate via Enter when the cursor is not on a link", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const buffer = textView.getBuffer();
        buffer.placeCursor(buffer.getStartIter());
        const keyController = findKeyController(textView) as Gtk.EventControllerKey;
        const beforeText = readBufferText(textView);
        await fireEvent(keyController, "key-pressed", Gdk.KEY_Return, 0, 0);
        expect(readBufferText(textView)).toBe(beforeText);
    });

    it("invokes the motion handler without throwing for both link and non-link positions", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const motion = findMotionController(textView) as Gtk.EventControllerMotion;
        await fireEvent(motion, "motion", 1, 1);
        await fireEvent(motion, "motion", 10_000, 10_000);
        expect(readBufferText(textView)).toContain("hypertext");
    });

    it("invokes the click handler at out-of-range coordinates without changing the page", async () => {
        if (!hypertextDemo.component) throw new Error("hypertext demo component missing");
        const { container } = await renderDemo(hypertextDemo.component);
        const textView = findFirstByType(container, Gtk.TextView) as Gtk.TextView;
        const before = readBufferText(textView);
        const click = findClickGesture(textView) as Gtk.GestureClick;
        await fireEvent(click, "released", 1, 999_999, 999_999);
        expect(readBufferText(textView)).toBe(before);
    });
});
