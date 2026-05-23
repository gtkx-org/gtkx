import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import * as Adw from "@gtkx/ffi/adw";
import type * as Gtk from "@gtkx/ffi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import type { ReactElement } from "react";
import { afterEach, describe, it } from "vitest";
import { Chapter1 } from "./chapters/1-window-and-header-bar";
import { Chapter2 } from "./chapters/2-styling";
import { Chapter3 } from "./chapters/3-lists";
import { Chapter4 } from "./chapters/4-menus-and-shortcuts";
import { Chapter5 } from "./chapters/5-navigation";
import { Chapter6 } from "./chapters/6-dialogs-and-animations";
import { Chapter7 } from "./chapters/7-settings-and-preferences";

let darkModeSet = false;
const ensureDarkMode = () => {
    if (!darkModeSet) {
        Adw.StyleManager.getDefault().setColorScheme(Adw.ColorScheme.FORCE_DARK);
        darkModeSet = true;
    }
};

const IMAGES_DIR = resolve(import.meta.dirname, "../docs/tutorial/images");

const saveScreenshot = async (filename: string) => {
    ensureDarkMode();
    const result = await screen.screenshot();
    writeFileSync(resolve(IMAGES_DIR, filename), Buffer.from(result.data, "base64"));
};

const saveDisplayScreenshot = async (filename: string) => {
    ensureDarkMode();
    await new Promise((resolve) => setTimeout(resolve, 200));
    execFileSync("import", ["-window", "root", "-trim", "+repage", `png:${resolve(IMAGES_DIR, filename)}`]);
};

interface ChapterDef {
    slug: string;
    description: string;
    Component: () => ReactElement;
    capture: "screen" | "display";
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
        capture: "display",
    },
];

describe("Tutorial Screenshots", () => {
    afterEach(async () => {
        await cleanup();
    });

    for (const { slug, description, Component, capture, setup } of chapters) {
        it(`captures chapter ${slug.split("-", 1)[0]}: ${description}`, async () => {
            await render(<Component />, { wrapper: false });
            await setup?.();
            const save = capture === "display" ? saveDisplayScreenshot : saveScreenshot;
            await save(`${slug}.png`);
        });
    }
});
