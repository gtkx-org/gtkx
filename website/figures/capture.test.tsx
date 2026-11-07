import * as Adw from "@gtkx/gi/adw";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { rootElement } from "@gtkx/react";
import { render, screen } from "@gtkx/testing";
import { fileURLToPath } from "node:url";
import type { ReactNode } from "react";
import { describe, expect, it } from "vitest";
import { EmployeeTable } from "./guide/components-column-view.js";
import { Circle } from "./guide/cairo-circle.js";
import { NameGrid } from "./guide/components-grid.js";
import { AccentOverride } from "./guide/css-accent.js";
import { Sidebar } from "./guide/components-list-box.js";
import { TaskList } from "./guide/components-list-view.js";
import { About } from "./guide/modals-about-dialog.js";
import { RenameDialog } from "./guide/modals-rename-dialog.js";
import { App as ListOfTasks } from "./tutorial/a-list-of-tasks/src/app.js";
import { App as FirstWindow } from "./tutorial/your-first-window.js";

const outputDir = fileURLToPath(new URL("../public/figures/", import.meta.url));

const schemes = [
    ["light", Adw.ColorScheme.FORCE_LIGHT],
    ["dark", Adw.ColorScheme.FORCE_DARK],
] as const;

function SampleWindow({
    title,
    width = 360,
    height = 260,
    children,
}: {
    title: string;
    width?: number;
    height?: number;
    children: ReactNode;
}) {
    return (
        <AdwApplication>
            <AdwApplicationWindow title={title} defaultWidth={width} defaultHeight={height}>
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <GtkScrolledWindow>{children}</GtkScrolledWindow>
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

const figures: [name: string, element: ReactNode][] = [
    ["tutorial-your-first-window", <FirstWindow />],
    ["tutorial-a-list-of-tasks", <ListOfTasks />],
    [
        "guide-components-list-view",
        <SampleWindow title="ListView">
            <TaskList />
        </SampleWindow>,
    ],
    [
        "guide-components-column-view",
        <SampleWindow title="ColumnView">
            <EmployeeTable />
        </SampleWindow>,
    ],
    [
        "guide-components-list-box",
        <SampleWindow title="GtkListBox">
            <Sidebar />
        </SampleWindow>,
    ],
    [
        "guide-components-grid",
        <SampleWindow title="GtkGrid">
            <NameGrid />
        </SampleWindow>,
    ],
    [
        "guide-css-accent",
        <SampleWindow title="CSS">
            <AccentOverride />
        </SampleWindow>,
    ],
    [
        "guide-cairo-circle",
        <SampleWindow title="Cairo">
            <Circle />
        </SampleWindow>,
    ],
    [
        "guide-modals-rename-dialog",
        <SampleWindow title="Lists" width={480} height={360}>
            <RenameDialog onResponse={() => {}} />
        </SampleWindow>,
    ],
    [
        "guide-modals-about-dialog",
        <SampleWindow title="Notes" width={480} height={600}>
            <About onClose={() => {}} />
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
