import * as Adw from "@gtkx/gi/adw";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { TaskList } from "./guide/components-list-view.js";
import { App as FirstWindow } from "./tutorial/your-first-window.js";

const outputDir = fileURLToPath(new URL("../public/figures/", import.meta.url));

const schemes = [
    ["light", Adw.ColorScheme.FORCE_LIGHT],
    ["dark", Adw.ColorScheme.FORCE_DARK],
] as const;

function SampleWindow({ title, children }: { title: string; children: ReactNode }) {
    return (
        <AdwApplication>
            <AdwApplicationWindow title={title} defaultWidth={360} defaultHeight={260}>
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <GtkScrolledWindow>{children}</GtkScrolledWindow>
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

const figures: [name: string, element: ReactNode][] = [
    ["tutorial-your-first-window", <FirstWindow />],
    [
        "guide-components-list-view",
        <SampleWindow title="ListView">
            <TaskList />
        </SampleWindow>,
    ],
];

const captures = figures.flatMap(([name, element]) =>
    schemes.map(([scheme, colorScheme]) => ({ file: `${name}-${scheme}.png`, element, colorScheme })),
);

describe("documentation figures", () => {
    it.each(captures)("captures $file", async ({ file, element, colorScheme }) => {
        Adw.StyleManager.getDefault().setColorScheme(colorScheme);
        await render(element, { container: rootElement });
        expect(Adw.StyleManager.getDefault().getDark()).toBe(colorScheme === Adw.ColorScheme.FORCE_DARK);
        await screen.screenshot({ scale: 2, path: `${outputDir}${file}` });
    });
});
