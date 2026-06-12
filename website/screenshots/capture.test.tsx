import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import type * as Gtk from "@gtkx/gi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import type { ReactElement } from "react";
import { afterEach, describe, it } from "vitest";
import { Chapter1 } from "./chapters/1-window-and-header-bar.js";
import { Chapter2 } from "./chapters/2-styling.js";
import { Chapter3 } from "./chapters/3-lists.js";
import { Chapter4 } from "./chapters/4-menus-and-shortcuts.js";
import { Chapter5 } from "./chapters/5-navigation.js";
import { Chapter6 } from "./chapters/6-dialogs-and-animations.js";
import { Chapter7 } from "./chapters/7-settings-and-preferences.js";
import { Chapter8 } from "./chapters/8-deploying.js";
import { setTheme, THEMES } from "./theme.js";

const OUT_DIR = resolve(import.meta.dirname, "out/tutorial");
const SCALE = 2;

mkdirSync(OUT_DIR, { recursive: true });

const saveSnapshot = async (filename: string, windowTitle?: string) => {
    const result = await screen.screenshot(windowTitle, { scale: SCALE });
    writeFileSync(resolve(OUT_DIR, filename), Buffer.from(result.data, "base64"));
};

const displayGrabSize = (process.env.GTKX_XVFB_SCREEN ?? "1024x768x24").split("x").slice(0, 2).join("x");

const grabWithFfmpeg = (path: string) => {
    execFileSync("ffmpeg", [
        "-y",
        "-loglevel",
        "error",
        "-f",
        "x11grab",
        "-draw_mouse",
        "0",
        "-video_size",
        displayGrabSize,
        "-i",
        process.env.DISPLAY ?? ":0",
        "-frames:v",
        "1",
        path,
    ]);
};

const grabWithImageMagick = (path: string) => {
    execFileSync("import", ["-window", "root", `png:${path}`]);
};

const isMissingBinary = (error: unknown): boolean =>
    error instanceof Error && "code" in error && error.code === "ENOENT";

const saveDisplayScreenshot = async (filename: string) => {
    await new Promise((resolveDelay) => setTimeout(resolveDelay, 200));
    const path = resolve(OUT_DIR, filename);
    try {
        grabWithFfmpeg(path);
    } catch (error) {
        if (!isMissingBinary(error)) throw error;
        grabWithImageMagick(path);
    }
};

interface ChapterDef {
    slug: string;
    description: string;
    Component: () => ReactElement;
    capture: "screen" | "display";
    windowTitle?: string;
    setup?: () => Promise<void>;
}

const chapters: ChapterDef[] = [
    { slug: "1-window-and-header-bar", description: "window and header bar", Component: Chapter1, capture: "screen" },
    { slug: "2-styling", description: "styling", Component: Chapter2, capture: "screen" },
    { slug: "3-lists", description: "lists", Component: Chapter3, capture: "screen" },
    {
        slug: "4-menus-and-shortcuts",
        description: "menus and shortcuts",
        Component: Chapter4,
        capture: "display",
        setup: async () => {
            const menuButton = await screen.findByName("app-menu");
            (menuButton as Gtk.MenuButton).popup();
        },
    },
    { slug: "5-navigation", description: "navigation", Component: Chapter5, capture: "screen" },
    {
        slug: "6-dialogs-and-animations",
        description: "dialogs and animations",
        Component: Chapter6,
        capture: "screen",
    },
    {
        slug: "7-settings-and-preferences",
        description: "settings and preferences",
        Component: Chapter7,
        capture: "screen",
        windowTitle: "Preferences",
    },
    {
        slug: "8-deploying",
        description: "deploying",
        Component: Chapter8,
        capture: "screen",
        setup: async () => {
            await screen.findByText("1.0.0");
            await new Promise((resolveDelay) => setTimeout(resolveDelay, 300));
        },
    },
];

describe("Tutorial Screenshots", () => {
    afterEach(async () => {
        await cleanup();
    });

    for (const theme of THEMES) {
        for (const { slug, description, Component, capture, windowTitle, setup } of chapters) {
            it(`captures chapter ${slug.split("-", 1)[0]}: ${description} (${theme})`, async () => {
                setTheme(theme);
                await render(<Component />, { wrapper: false });
                await setup?.();
                const filename = `${slug}-${theme}.png`;
                if (capture === "display") {
                    await saveDisplayScreenshot(filename);
                } else {
                    await saveSnapshot(filename, windowTitle);
                }
            });
        }
    }
});
