import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { act, fireEvent, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { hypertextDemo } from "../../../src/demos/input/hypertext.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

const spawnMock = vi.hoisted(() => vi.fn((_command: string, _args: string[]) => ({ on() {} })));
vi.mock("node:child_process", async (importOriginal) => {
    const actual = (await importOriginal()) as Record<string, unknown>;
    return { ...actual, spawn: spawnMock };
});

const findTextView = async (): Promise<Gtk.TextView> =>
    (await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX)) as Gtk.TextView;

const demoClickGesture = (view: Gtk.TextView): Gtk.GestureClick => {
    const controllers = view.observeControllers();
    for (let i = 0; i < controllers.getNItems(); i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof Gtk.GestureClick && controller.getButton() === 1) return controller;
    }
    throw new Error("hypertext demo GestureClick (button 1) not found");
};

const demoMotionController = (view: Gtk.TextView): Gtk.EventControllerMotion => {
    const controllers = view.observeControllers();
    for (let i = 0; i < controllers.getNItems(); i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof Gtk.EventControllerMotion) return controller;
    }
    throw new Error("hypertext demo EventControllerMotion not found");
};

const demoKeyController = (view: Gtk.TextView): Gtk.EventControllerKey => {
    const controllers = view.observeControllers();
    for (let i = 0; i < controllers.getNItems(); i++) {
        const controller = controllers.getItem(i);
        if (controller instanceof Gtk.EventControllerKey) return controller;
    }
    throw new Error("hypertext demo EventControllerKey not found");
};

const windowCoordsAtOffset = (view: Gtk.TextView, offset: number): [number, number] => {
    const iter = view.getBuffer().getIterAtOffset(offset);
    const rect = view.getIterLocation(iter);
    return view.bufferToWindowCoords(Gtk.TextWindowType.WIDGET, rect.x + 1, rect.y + Math.trunc(rect.height / 2));
};

const clickOffset = async (view: Gtk.TextView, offset: number): Promise<void> => {
    const [x, y] = windowCoordsAtOffset(view, offset);
    await act(() => demoClickGesture(view).emit("released", 1, x, y));
};

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
        expect(screen.getByDisplayValue(/simple /)).toBe(textView);
        expect(screen.getByDisplayValue(/hypertext/)).toBe(textView);
        expect(screen.getByDisplayValue(/can easily be realized with /)).toBe(textView);
        expect(screen.getByDisplayValue(/tags/)).toBe(textView);
    });

    it("embeds the ghost label, the level bar, and the emoji in page 1", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const levelBar = (await screen.findByRole(Gtk.AccessibleRole.METER)) as Gtk.LevelBar;
        expect(levelBar.getValue()).toBe(50);
        expect(levelBar.getMinValue()).toBe(0);
        expect(levelBar.getMaxValue()).toBe(100);
        expect(await screen.findByText("ghost")).toHaveTextContent("ghost");
        expect(readBufferText(textView)).toContain("😋");
    });
});

describe("hypertextDemo link navigation", () => {
    it("navigates to the tags definition page when Enter is pressed at the tags link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const tagsOffset = readBufferText(textView).indexOf("tags");
        expect(tagsOffset).toBeGreaterThan(0);
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(tagsOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied to some range of text/);
    });

    it("navigates to the hypertext definition page when Enter is pressed at the hypertext link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const linkOffset = readBufferText(textView).indexOf("hypertext");
        expect(linkOffset).toBeGreaterThan(0);
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(linkOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/Machine-readable text that is not sequential/);
    });

    it("navigates via the numeric-keypad Enter key at a link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const tagsOffset = readBufferText(textView).indexOf("tags");
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(tagsOffset)));
        await fireEvent(demoKeyController(textView), "key-pressed", Gdk.KEY_KP_Enter, 0, 0);
        await screen.findByDisplayValue(/attribute that can be applied to some range of text/);
    });
});

describe("hypertextDemo click navigation", () => {
    it("follows the hypertext link to the definition page when clicked", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const linkOffset = readBufferText(textView).indexOf("hypertext");
        await clickOffset(textView, linkOffset);
        await screen.findByDisplayValue(/Machine-readable text that is not sequential/);
    });

    it("follows the tags link to the definition page when clicked", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const linkOffset = readBufferText(textView).indexOf("tags");
        await clickOffset(textView, linkOffset);
        await screen.findByDisplayValue(/attribute that can be applied to some range of text/);
    });

    it("returns to page 1 when the Go back link is clicked on a definition page", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        await clickOffset(textView, readBufferText(textView).indexOf("hypertext"));
        await screen.findByDisplayValue(/Machine-readable text that is not sequential/);
        await clickOffset(textView, readBufferText(textView).indexOf("Go back") + 1);
        await screen.findByDisplayValue(/Some text to show that simple/);
        expect(screen.queryByDisplayValue(/Machine-readable text that is not sequential/)).toBeNull();
    });
});

describe("hypertextDemo round trip", () => {
    it("navigates from page 2 (tags) back to page 1 via the Go back link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const tagsOffset = readBufferText(textView).indexOf("tags");
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(tagsOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);
        const pageTwo = readBufferText(textView);
        const backOffset = pageTwo.indexOf("Go back");
        expect(backOffset).toBeGreaterThanOrEqual(0);
        const bufferAfter = textView.getBuffer();
        await act(() => bufferAfter.placeCursor(bufferAfter.getIterAtOffset(backOffset + 1)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/can easily be realized with |Some text to show/);
    });
});

describe("hypertextDemo hover cursor", () => {
    it("swaps the text view cursor to a pointer over a link and back to text off it", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const motion = demoMotionController(textView);

        const [linkX, linkY] = windowCoordsAtOffset(textView, readBufferText(textView).indexOf("tags"));
        await act(() => motion.emit("motion", linkX, linkY));
        expect(textView.getCursor()?.getName()).toBe("pointer");

        const [textX, textY] = windowCoordsAtOffset(textView, 2);
        await act(() => motion.emit("motion", textX, textY));
        expect(textView.getCursor()?.getName()).toBe("text");
    });
});

describe("hypertextDemo speaker icon", () => {
    it("speaks the word when the speaker icon on a definition page is clicked", async () => {
        spawnMock.mockClear();
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        const tagsOffset = readBufferText(textView).indexOf("tags");
        await act(() => buffer.placeCursor(buffer.getIterAtOffset(tagsOffset)));
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);

        const speaker = (await screen.findByRole(Gtk.AccessibleRole.IMG)) as Gtk.Image;
        const controllers = speaker.observeControllers();
        let gesture: Gtk.GestureClick | null = null;
        for (let i = 0; i < controllers.getNItems(); i++) {
            const controller = controllers.getItem(i);
            if (controller instanceof Gtk.GestureClick) gesture = controller;
        }
        expect(gesture).not.toBeNull();
        await fireEvent(gesture as Gtk.GestureClick, "pressed", 1, 0, 0);

        expect(spawnMock).toHaveBeenCalledTimes(1);
        expect(spawnMock.mock.calls[0]?.[0]).toBe("espeak-ng");
        expect(spawnMock.mock.calls[0]?.[1]).toEqual(["tag"]);
    });
});

describe("hypertextDemo input edge cases", () => {
    it("ignores non-Enter key presses without changing the page", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        await userEvent.keyboard(textView, "a");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("does not navigate via Enter when the cursor is not on a link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        const buffer = textView.getBuffer();
        await act(() => buffer.placeCursor(buffer.getStartIter()));
        await userEvent.keyboard(textView, "{Enter}");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("does not navigate when a click lands off any link", async () => {
        await renderDemo(hypertextDemo);
        const textView = await findTextView();
        await clickOffset(textView, 2);
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });
});
