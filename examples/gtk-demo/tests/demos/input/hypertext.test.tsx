import * as Gtk from "@gtkx/gi/gtk";
import { screen, userEvent, waitFor } from "@gtkx/testing";
import { resolveExecutable } from "@gtkx/utils";
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { hypertextDemo } from "../../../src/demos/input/hypertext.js";
import { readBufferText, renderDemo } from "../../test-utils.js";

const findTextView = async (): Promise<Gtk.TextView> =>
    screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { as: Gtk.TextView });

const renderTextView = async (): Promise<Gtk.TextView> => {
    await renderDemo(hypertextDemo);

    return await findTextView();
};

const placeCursorAtWord = async (view: Gtk.TextView, word: string, offsetWithinWord = 0): Promise<void> => {
    const offset = readBufferText(view).indexOf(word);

    if (offset === -1) {
        throw new Error(`the hypertext buffer does not contain ${word}`);
    }

    view.grabFocus();
    await userEvent.keyboard(view, "{Control>}{Home}{/Control}");
    await userEvent.keyboard(view, "{ArrowRight}".repeat(offset + offsetWithinWord));
};

const recordSpeech = (): Disposable & { path: string; done: string } => {
    const executable = resolveExecutable("espeak-ng");
    const directory = mkdtempSync(join(tmpdir(), "gtkx-hypertext-speech-"));
    const path = join(directory, "speech.wav");
    const done = join(directory, "done");
    const originalPath = process.env.PATH;
    writeFileSync(join(directory, "espeak-ng"), `#!${process.execPath}
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const result = spawnSync(${JSON.stringify(executable)}, ["-w", ${JSON.stringify(path)}, ...process.argv.slice(2)]);
if (result.status !== 0) process.exit(result.status ?? 1);
writeFileSync(${JSON.stringify(done)}, "");
`, { mode: 0o755 });
    process.env.PATH = `${directory}:${originalPath ?? ""}`;

    return {
        path,
        done,
        [Symbol.dispose]: () => {
            if (originalPath === undefined) {
                delete process.env.PATH;
            } else {
                process.env.PATH = originalPath;
            }
            rmSync(directory, { recursive: true, force: true });
        },
    };
};

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
        expect(levelBar).toHaveAccessibleName("Example level");
        expect(levelBar).toHaveObjectProperty("value", 50);
        expect(levelBar).toHaveObjectProperty("minValue", 0);
        expect(levelBar).toHaveObjectProperty("maxValue", 100);
        expect(await screen.findByText("ghost")).toHaveTextContent("ghost");
        expect(readBufferText(textView)).toContain("😋");
    });

    it("copies the ghost replacement character from the text buffer", async () => {
        const textView = await renderTextView();
        const buffer = textView.getBuffer();
        buffer.selectRange(buffer.getStartIter(), buffer.getEndIter());
        await userEvent.copy(textView);
        expect(await textView.getClipboard().readTextAsync()).toContain("👻");
    });
});

describe("hypertextDemo link navigation", () => {
    it("navigates to the tags definition page when Enter is pressed at the tags link", async () => {
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "tags");
        await userEvent.keyboard(textView, "{Enter}");
        expect(await screen.findByDisplayValue(/attribute that can be applied to some range of text/)).toBe(textView);
    });

    it("navigates to the hypertext definition page when Enter is pressed at the hypertext link", async () => {
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "hypertext");
        await userEvent.keyboard(textView, "{Enter}");
        expect(await screen.findByDisplayValue(/Machine-readable text that is not sequential/)).toBe(textView);
    });
});

describe("hypertextDemo round trip", () => {
    it("navigates from page 2 (tags) back to page 1 via the Go back link", async () => {
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "tags");
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);
        await placeCursorAtWord(textView, "Go back", 1);
        await userEvent.keyboard(textView, "{Enter}");
        expect(await screen.findByDisplayValue(/can easily be realized with |Some text to show/)).toBe(textView);
    });
});

describe("hypertextDemo speaker icon", () => {
    it("speaks the word when the speaker icon on a definition page is clicked", async () => {
        using speech = recordSpeech();
        const textView = await renderTextView();
        await placeCursorAtWord(textView, "tags");
        await userEvent.keyboard(textView, "{Enter}");
        await screen.findByDisplayValue(/attribute that can be applied/);
        const speaker = await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Speak tag", as: Gtk.Button });
        await userEvent.click(speaker);
        await waitFor(() => {
            expect(existsSync(speech.done)).toBe(true);
        });
        const audio = readFileSync(speech.path);
        expect(audio.subarray(0, 4).toString()).toBe("RIFF");
        expect(audio.subarray(8, 12).toString()).toBe("WAVE");
        expect(audio.length).toBeGreaterThan(44);
    });
});

describe("hypertextDemo input edge cases", () => {
    it("preserves the document and link targets after typing and deletion attempts", async () => {
        const textView = await renderTextView();
        const text = readBufferText(textView);
        textView.grabFocus();
        await userEvent.keyboard(textView, "{Control>}{Home}{/Control}");
        await userEvent.type(textView, "prefix");
        await userEvent.keyboard(textView, "{Delete}{Enter}");
        expect(readBufferText(textView)).toBe(text);
        await placeCursorAtWord(textView, "tags");
        await userEvent.keyboard(textView, "{Enter}");
        expect(await screen.findByDisplayValue(/attribute that can be applied/)).toBe(textView);
    });

    it("rejects clearing the read-only document", async () => {
        const textView = await renderTextView();
        const text = readBufferText(textView);
        await expect(userEvent.clear(textView)).rejects.toThrow();
        expect(readBufferText(textView)).toBe(text);
    });

    it("ignores non-Enter key presses without changing the page", async () => {
        const textView = await renderTextView();
        await userEvent.keyboard(textView, "a");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });

    it("does not navigate via Enter when the cursor is not on a link", async () => {
        const textView = await renderTextView();
        textView.grabFocus();
        await userEvent.keyboard(textView, "{Control>}{Home}{/Control}");
        await userEvent.keyboard(textView, "{Enter}");
        expect(screen.getByDisplayValue(/Some text to show/)).toBe(textView);
        expect(screen.queryByDisplayValue(/attribute that can be applied/)).toBeNull();
    });
});
