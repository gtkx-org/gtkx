/**
 * The editor half of the hero recording: a GTKX-built code editor
 * (GtkSourceView with TypeScript highlighting) that opens the tutorial's
 * note-card component, types two style edits with a human cadence, and saves
 * each one to the REAL file — `record-hero.ts` runs `gtkx dev` on the tutorial
 * app at the same time, so every save triggers an authentic Vite Fast Refresh
 * in the Notes window being recorded next to this one.
 *
 * Run through `screenshots/vitest.hero.config.ts` only; the stage records its
 * own Xvfb display with ffmpeg for the scripted duration.
 */
import { type ChildProcess, spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Adw from "@gtkx/gi/adw";
import type * as GtkSource from "@gtkx/gi/gtksource";
import { AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { GtkSourceBuffer, GtkSourceView } from "@gtkx/jsx/gtksource";
import { render } from "@gtkx/testing";
import { createRef } from "react";
import { it } from "vitest";

const NOTE_CARD_PATH = resolve(import.meta.dirname, "../../examples/tutorial/src/components/note-card.tsx");
const OUT_PATH = resolve(import.meta.dirname, "out/hero-editor.mkv");
const RECORD_SECONDS = 16;

const EDIT_ONE = {
    find: "background: @card_bg_color;",
    deletion: "@card_bg_color",
    insertion: "alpha(@accent_bg_color, 0.25)",
    saveAt: 7_500,
};

const EDIT_TWO = {
    find: "border-radius: 12px;",
    deletion: "12px",
    insertion: "24px",
    saveAt: 13_000,
};

const sleep = (ms: number): Promise<void> => new Promise((resolveDelay) => setTimeout(resolveDelay, ms));

const startRecorder = (): ChildProcess =>
    spawn(
        "ffmpeg",
        [
            "-y",
            "-loglevel",
            "error",
            "-f",
            "x11grab",
            "-draw_mouse",
            "0",
            "-framerate",
            "30",
            "-video_size",
            (process.env.GTKX_XVFB_SCREEN ?? "800x900x24").split("x").slice(0, 2).join("x"),
            "-i",
            process.env.DISPLAY ?? ":0",
            "-t",
            String(RECORD_SECONDS),
            "-c:v",
            "libx264rgb",
            "-qp",
            "0",
            OUT_PATH,
        ],
        { stdio: ["ignore", "ignore", "inherit"] },
    );

interface BufferEditor {
    deleteRange(start: number, end: number): void;
    insertAt(offset: number, text: string): void;
    text(): string;
}

const editorFor = (buffer: GtkSource.Buffer): BufferEditor => ({
    deleteRange(start, end) {
        buffer.delete(buffer.getIterAtOffset(start), buffer.getIterAtOffset(end));
    },
    insertAt(offset, text) {
        const iter = buffer.getIterAtOffset(offset);
        buffer.insert(iter, text, -1);
        buffer.placeCursor(buffer.getIterAtOffset(offset + text.length));
    },
    text() {
        return buffer.getText(buffer.getStartIter(), buffer.getEndIter(), false);
    },
});

const typeEdit = async (
    editor: BufferEditor,
    edit: { find: string; deletion: string; insertion: string },
): Promise<void> => {
    const source = editor.text();
    const lineStart = source.indexOf(edit.find);
    if (lineStart === -1) throw new Error(`Hero stage could not find "${edit.find}" in the buffer`);
    const start = lineStart + edit.find.indexOf(edit.deletion);

    for (let remaining = edit.deletion.length; remaining > 0; remaining--) {
        editor.deleteRange(start + remaining - 1, start + remaining);
        await sleep(35);
    }
    for (let i = 0; i < edit.insertion.length; i++) {
        const char = edit.insertion[i] ?? "";
        editor.insertAt(start + i, char);
        await sleep(55);
    }
};

it("performs the hero editor scene", async () => {
    const originalSource = readFileSync(NOTE_CARD_PATH, "utf8");
    const bufferRef = createRef<GtkSource.Buffer>();

    Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.FORCE_DARK);

    const GtkSourceModule = await import("@gtkx/gi/gtksource");
    const tsLanguage =
        GtkSourceModule.LanguageManager.getDefault().getLanguage("typescript") ??
        GtkSourceModule.LanguageManager.getDefault().getLanguage("js");
    const darkScheme = GtkSourceModule.StyleSchemeManager.getDefault().getScheme("Adwaita-dark");

    await render(
        <AdwApplicationWindow title="note-card.tsx — GTKX" defaultWidth={800} defaultHeight={900}>
            <AdwToolbarView addTopBar={<AdwHeaderBar />}>
                <GtkScrolledWindow vexpand>
                    <GtkSourceView
                        showLineNumbers
                        monospace
                        highlightCurrentLine
                        topMargin={8}
                        leftMargin={8}
                    >
                        <GtkSourceBuffer ref={bufferRef} language={tsLanguage} styleScheme={darkScheme}>
                            {originalSource}
                        </GtkSourceBuffer>
                    </GtkSourceView>
                </GtkScrolledWindow>
            </AdwToolbarView>
        </AdwApplicationWindow>,
        { wrapper: false },
    );

    const buffer = bufferRef.current;
    if (!buffer) throw new Error("Hero stage has no source buffer");
    const editor = editorFor(buffer);

    const recorder = startRecorder();
    const startedAt = Date.now();
    const until = (ms: number) => sleep(Math.max(0, ms - (Date.now() - startedAt)));

    try {
        await until(3_000);
        await typeEdit(editor, EDIT_ONE);
        await until(EDIT_ONE.saveAt);
        writeFileSync(NOTE_CARD_PATH, editor.text());

        await until(10_500);
        await typeEdit(editor, EDIT_TWO);
        await until(EDIT_TWO.saveAt);
        writeFileSync(NOTE_CARD_PATH, editor.text());

        await until(RECORD_SECONDS * 1000 + 500);
        await new Promise<void>((resolveExit) => {
            if (recorder.exitCode !== null) return resolveExit();
            recorder.once("exit", () => resolveExit());
        });
    } finally {
        writeFileSync(NOTE_CARD_PATH, originalSource);
        if (recorder.exitCode === null) recorder.kill("SIGINT");
    }
}, 60_000);
