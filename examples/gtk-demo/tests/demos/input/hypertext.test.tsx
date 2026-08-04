import * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import { act, fireEvent, getAllControllers, getController, queryController, screen, userEvent } from "@gtkx/testing";
import { describe, expect, it, vi } from "vitest";
import { hypertextDemo } from "../../../src/demos/input/hypertext.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

const spawnMock = vi.hoisted(() =>
    vi.fn<(command: string, args: string[]) => { on: () => void }>(() => ({ on: vi.fn() })),
);

const findTextView = async (): Promise<Gtk.TextView> =>
    screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });

const demoClickGesture = (view: Gtk.TextView): Gtk.GestureClick => {
    const gesture = getAllControllers(view, Gtk.GestureClick).find((candidate) => candidate.getButton() === 1);

    if (!gesture) {
        throw new Error("hypertext demo GestureClick not found");
    }

    return gesture;
};

const demoMotionController = (view: Gtk.TextView): Gtk.EventControllerMotion =>
    getController(view, Gtk.EventControllerMotion);

const demoKeyController = (view: Gtk.TextView): Gtk.EventControllerKey =>
    getController(view, Gtk.EventControllerKey);

const windowCoordsAtOffset = (view: Gtk.TextView, offset: number): [number, number] => {
    const iter = view.getBuffer().getIterAtOffset(offset);
    const rect = view.getIterLocation(iter);

    return view.bufferToWindowCoords(Gtk.TextWindowType.WIDGET, rect.x + 1, rect.y + Math.trunc(rect.height / 2));
};

const renderTextView = async (): Promise<Gtk.TextView> => {
    await renderDemo(hypertextDemo);

    return await findTextView();
};

const placeCursorAtWord = async (view: Gtk.TextView, word: string): Promise<number> => {
    const buffer = view.getBuffer();
    const offset = readBufferText(view).indexOf(word);

    await act(() => {
        buffer.placeCursor(buffer.getIterAtOffset(offset));
    });

    return offset;
};

const clickOffset = async (view: Gtk.TextView, offset: number): Promise<void> => {
    const [x, y] = windowCoordsAtOffset(view, offset);

    await act(() => {
        demoClickGesture(view).emit("released", 1, x, y);
    });
};

vi.mock("node:child_process", async (importOriginal) => {
    const actual = await importOriginal<typeof import("node:child_process")>();

    return { ...actual, spawn: spawnMock };
});

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
        const textView = await renderTextView();
        expect(screen.getByDisplayValue(/simple /)).toBe(textView);
        expect(screen.getByDisplayValue(/hypertext/)).toBe(textView);
        expect(screen.getByDisplayValue(/can easily be realized with /)).toBe(textView);
        expect(screen.getByDisplayValue(/tags/)).toBe(textView);
    });

    it("embeds the ghost label, the level bar, and the emoji in page 1", async () => {
        const textView = await renderTextView();
        const levelBar = await screen.findByRole(Gtk.AccessibleRole.METER, { as: Gtk.LevelBar });
        expect(levelBar).toHaveObjectProperty("value", 50);
        expect(levelBar).toHaveObjectProperty("minValue", 0);
        expect(levelBar).toHaveObjectProperty("maxValue", 100);
        expect(await screen.findByText("ghost")).toHaveTextContent("ghost");
        expect(readBufferText(textView)).toContain("😋");
    });
});

describe("hypertextDemo link navigation", () => {
    it("navigates to the tags definition page when Enter is pressed at the tags link", async () => {
        const textView = await renderTextView();
        const tagsOffset = await placeCursorAtWord(textView, "tags");
        expect(tagsOffset).toBeGreaterThan(0);
        await userEvent.keyboard(textView, "{Enter}");
        expect(await screen.findByDisplayValue(/attribute that can be applied to some range of text/)).toBe(textView);
    });

    it("navigates to the hypertext definition page when Enter is pressed at the hypertext link", async () => {
        const textView = await renderTextView();
        const linkOffset = await placeCursorAtWord(textView, "hypertext");
        expect(linkOffset).toBeGreaterThan(0);
        await userEvent.keyboard(textView, "{Enter}");
        expect(await screen.findByDisplayValue(/Machine-readable text that is not sequential/)).toBe(textView);
    });

    it("navigates via the numeric-keypad Enter key at a link", async () => {
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "tags");
        await fireEvent(demoKeyController(textView), "key-pressed", Gdk.KEY_KP_Enter, 0, 0);
        expect(await screen.findByDisplayValue(/attribute that can be applied to some range of text/)).toBe(textView);
    });
});

describe("hypertextDemo click navigation", () => {
    it("follows the hypertext link to the definition page when clicked", async () => {
        const textView = await renderTextView();
        const linkOffset = readBufferText(textView).indexOf("hypertext");
        await clickOffset(textView, linkOffset);
        expect(await screen.findByDisplayValue(/Machine-readable text that is not sequential/)).toBe(textView);
    });

    it("follows the tags link to the definition page when clicked", async () => {
        const textView = await renderTextView();
        const linkOffset = readBufferText(textView).indexOf("tags");
        await clickOffset(textView, linkOffset);
        expect(await screen.findByDisplayValue(/attribute that can be applied to some range of text/)).toBe(textView);
    });

    it("returns to page 1 when the Go back link is clicked on a definition page", async () => {
        const textView = await renderTextView();
        await clickOffset(textView, readBufferText(textView).indexOf("hypertext"));
        await screen.findByDisplayValue(/Machine-readable text that is not sequential/);
        await clickOffset(textView, readBufferText(textView).indexOf("Go back") + 1);
        await screen.findByDisplayValue(/Some text to show that simple/);
        expect(screen.queryByDisplayValue(/Machine-readable text that is not sequential/)).toBeNull();
    });
});

describe("hypertextDemo round trip", () => {
    it("navigates from page 2 (tags) back to page 1 via the Go back link", async () => {
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "tags");
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);
        const pageTwo = readBufferText(textView);
        const backOffset = pageTwo.indexOf("Go back");
        expect(backOffset).toBeGreaterThanOrEqual(0);
        const bufferAfter = textView.getBuffer();

        await act(() => {
            bufferAfter.placeCursor(bufferAfter.getIterAtOffset(backOffset + 1));
        });

        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/can easily be realized with |Some text to show/);
    });
});

describe("hypertextDemo hover cursor", () => {
    it("swaps the text view cursor to a pointer over a link and back to text off it", async () => {
        const textView = await renderTextView();
        const motion = demoMotionController(textView);
        const [linkX, linkY] = windowCoordsAtOffset(textView, readBufferText(textView).indexOf("tags"));

        await act(() => {
            motion.emit("motion", linkX, linkY);
        });

        expect(textView.getCursor()?.getName()).toBe("pointer");
        const [textX, textY] = windowCoordsAtOffset(textView, 2);

        await act(() => {
            motion.emit("motion", textX, textY);
        });

        expect(textView.getCursor()?.getName()).toBe("text");
    });
});

describe("hypertextDemo speaker icon", () => {
    it("speaks the word when the speaker icon on a definition page is clicked", async () => {
        spawnMock.mockClear();
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "tags");
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);
        const speaker = await screen.findByRole(Gtk.AccessibleRole.IMG, { as: Gtk.Image });
        const gesture = queryController(speaker, Gtk.GestureClick);
        expect(gesture).not.toBeNull();
        await fireEvent(gesture as Gtk.GestureClick, "pressed", 1, 0, 0);
        expect(spawnMock).toHaveBeenCalledTimes(1);
        expect(spawnMock.mock.calls[0]?.[0]).toBe("espeak-ng");
        expect(spawnMock.mock.calls[0]?.[1]).toEqual(["tag"]);
    });
});

describe("hypertextDemo input edge cases", () => {
    it("ignores non-Enter key presses without changing the page", async () => {
        const textView = await renderTextView();
        await userEvent.keyboard(textView, "a");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("does not navigate via Enter when the cursor is not on a link", async () => {
        const textView = await renderTextView();
        const buffer = textView.getBuffer();

        await act(() => {
            buffer.placeCursor(buffer.getStartIter());
        });

        await userEvent.keyboard(textView, "{Enter}");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("does not navigate when a click lands off any link", async () => {
        const textView = await renderTextView();
        await clickOffset(textView, 2);
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });
});
