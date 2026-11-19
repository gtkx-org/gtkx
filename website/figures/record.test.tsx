import * as Adw from "@gtkx/gi/adw";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkBox } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render } from "@gtkx/testing";
import { spawn } from "node:child_process";
import { once } from "node:events";
import { cpSync, mkdirSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { userInfo } from "node:os";
import { dirname, join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { Deadline } from "./guide/animations-deadline.js";
import { Slide } from "./guide/animations-slide.js";
import { type ClipSize, fillDisplay, fitDisplay, recordClip, watchOutput } from "./recorder.js";
import { seedNotes } from "./tutorial/notes.js";
import { defaultFolder } from "./tutorial/the-notes-folder/src/notes/files.js";

const figuresDir = fileURLToPath(new URL(".", import.meta.url));
const outputDir = join(figuresDir, "../public/clips");
const mirrorDir = join(figuresDir, ".clips");
const gtkxBin = join(dirname(createRequire(import.meta.url).resolve("@gtkx/cli/package.json")), "bin/gtkx.js");

const SETTLE = 600;
const START_TIMEOUT = 60_000;
const REFRESH_TIMEOUT = 20_000;
const MAX_CLIP_BYTES = 400_000;

const schemes = [
    {
        scheme: "light",
        colorScheme: Adw.ColorScheme.FORCE_LIGHT,
        preference: "prefer-light",
    },
    {
        scheme: "dark",
        colorScheme: Adw.ColorScheme.FORCE_DARK,
        preference: "prefer-dark",
    },
] as const;

type Scheme = (typeof schemes)[number];

type Take = (performance: () => Promise<void>) => Promise<void>;

type Clip = {
    name: string;
    size: ClipSize;
    play: (scheme: Scheme, take: Take) => Promise<void>;
};

function SampleWindow({ size, children }: { size: ClipSize; children: ReactNode }) {
    return (
        <AdwApplication>
            <AdwApplicationWindow title="Animations" defaultWidth={size.width} defaultHeight={size.height}>
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <GtkBox marginTop={24} marginBottom={24} marginStart={24} marginEnd={24}>
                        {children}
                    </GtkBox>
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

const playSample =
    (size: ClipSize, sample: (isOn: boolean) => ReactNode): Clip["play"] =>
    async ({ colorScheme }, take) => {
        const frame = (isOn: boolean) => <SampleWindow size={size}>{sample(isOn)}</SampleWindow>;

        Adw.StyleManager.getDefault().setColorScheme(colorScheme);
        const view = await render(frame(false), {
            container: rootElement,
            areAnimationsEnabled: true,
        });
        fillDisplay();
        await delay(SETTLE);
        await take(async () => {
            await delay(700);
            await view.rerender(frame(true));
            await delay(1500);
            await view.rerender(frame(false));
            await delay(1500);
        });
    };

const childEnv = (preference: Scheme["preference"]): NodeJS.ProcessEnv => {
    const env: NodeJS.ProcessEnv = {};

    for (const [name, value] of Object.entries(process.env)) {
        if (!name.startsWith("VITEST") && name !== "NODE_ENV") {
            env[name] = value;
        }
    }

    return {
        ...env,
        ADW_DEBUG_COLOR_SCHEME: preference,
        XDG_CACHE_HOME: join(userInfo().homedir, ".cache"),
    };
};

const fromQuoteBlock = (source: string): number => {
    const index = source.indexOf("const QuoteBlock");

    if (index === -1) {
        throw new Error("markdown-preview.tsx no longer declares QuoteBlock");
    }

    return index;
};

const playFastRefresh: Clip["play"] = async ({ preference }, take) => {
    const preview = "tutorial/fast-refresh/src/preview/markdown-preview.tsx";
    const edited = join(mirrorDir, preview);
    const after = readFileSync(join(figuresDir, preview), "utf8");

    seedNotes(defaultFolder());
    rmSync(mirrorDir, { recursive: true, force: true });
    mkdirSync(join(mirrorDir, "clips"), { recursive: true });
    cpSync(join(figuresDir, "tutorial/the-markdown-preview/src"), join(mirrorDir, "tutorial/fast-refresh/src"), {
        recursive: true,
    });
    cpSync(join(figuresDir, "clips/fast-refresh.tsx"), join(mirrorDir, "clips/fast-refresh.tsx"));

    const before = readFileSync(edited, "utf8");
    const withCard = after.slice(0, fromQuoteBlock(after)) + before.slice(fromQuoteBlock(before));
    const dev = spawn(process.execPath, [gtkxBin, "dev", ".clips/clips/fast-refresh.tsx"], {
        cwd: figuresDir,
        env: childEnv(preference),
        stdio: ["ignore", "pipe", "pipe"],
    });
    const exited = once(dev, "exit");
    const output = watchOutput(dev);

    try {
        await output.next("clip-ready", START_TIMEOUT);
        fillDisplay();
        await delay(SETTLE);
        await take(async () => {
            await delay(1200);
            writeFileSync(edited, withCard);
            await output.next("Fast Refresh complete", REFRESH_TIMEOUT);
            await delay(1600);
            writeFileSync(edited, after);
            await output.next("Fast Refresh complete", REFRESH_TIMEOUT);
            await delay(2200);
        });
    } finally {
        dev.kill("SIGINT");
        await exited;
        rmSync(mirrorDir, { recursive: true, force: true });
    }
};

const sampleSize = { width: 360, height: 160 };

const clips: Clip[] = [
    {
        name: "tutorial-fast-refresh",
        size: { width: 720, height: 480 },
        play: playFastRefresh,
    },
    {
        name: "guide-animations-deadline",
        size: sampleSize,
        play: playSample(sampleSize, (isOverdue) => <Deadline isOverdue={isOverdue} />),
    },
    {
        name: "guide-animations-slide",
        size: sampleSize,
        play: playSample(sampleSize, (isOpen) => <Slide isOpen={isOpen} />),
    },
];

const takes = clips.flatMap((clip) =>
    schemes.map((scheme) => ({
        ...clip,
        scheme,
        file: `${clip.name}-${scheme.scheme}`,
    })),
);

describe("documentation clips", () => {
    it.each(takes)("records $file", async ({ file, size, play, scheme }) => {
        const video = join(outputDir, `${file}.webm`);

        mkdirSync(outputDir, { recursive: true });
        fitDisplay(size);
        await play(scheme, (performance) => recordClip({ video, poster: join(outputDir, `${file}.png`) }, performance));
        expect(statSync(video).size).toBeLessThan(MAX_CLIP_BYTES);
    });
});
