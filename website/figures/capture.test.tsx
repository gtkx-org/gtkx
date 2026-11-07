import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { rootElement } from "@gtkx/react";
import { render, screen, userEvent } from "@gtkx/testing";
import { writeFileSync } from "node:fs";
import { join } from "node:path";
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
import { App as DrawerApp } from "./guide/navigation-drawer.js";
import { Mail as SplitMail } from "./guide/navigation-split-view.js";
import { Notes } from "./guide/navigation-stack.js";
import { seedNotes } from "./tutorial/notes.js";
import { App as NoteEditor } from "./tutorial/the-note-editor/src/app.js";
import { App as NotesFolder } from "./tutorial/the-notes-folder/src/app.js";
import { App as SavingAndWatching } from "./tutorial/saving-and-watching/src/app.js";
import { defaultFolder } from "./tutorial/the-notes-folder/src/notes/files.js";
import { App as FirstWindow } from "./tutorial/your-first-window/src/app.js";
import { Mail as TabMail } from "./guide/navigation-tabs.js";

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

function NavigationWindow({
    title,
    width,
    height,
    children,
}: {
    title: string;
    width: number;
    height: number;
    children: ReactNode;
}) {
    return (
        <AdwApplication>
            <AdwApplicationWindow title={title} defaultWidth={width} defaultHeight={height}>
                <NavigationContainer>{children}</NavigationContainer>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

type FigureOptions = {
    before?: () => void;
    prepare?: () => Promise<void>;
};

const figures: [name: string, element: ReactNode, options?: FigureOptions][] = [
    ["tutorial-your-first-window", <FirstWindow />],
    [
        "tutorial-the-notes-folder",
        <NotesFolder />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
            },
        },
    ],
    [
        "tutorial-the-note-editor",
        <NoteEditor />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                await userEvent.click(
                    await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Website relaunch" }),
                );
                await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note text" });
            },
        },
    ],
    [
        "tutorial-saving-and-watching",
        <SavingAndWatching />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                await userEvent.click(
                    await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Website relaunch" }),
                );
                await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note text" });
                writeFileSync(join(defaultFolder(), "Groceries.md"), "# Groceries\n\nOat milk, lemons, basil.\n");
                await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Groceries" });
            },
        },
    ],
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
    [
        "guide-navigation-stack",
        <NavigationWindow title="Notes" width={360} height={260}>
            <Notes />
        </NavigationWindow>,
    ],
    [
        "guide-navigation-tabs",
        <NavigationWindow title="Mail" width={360} height={440}>
            <TabMail unread={3} />
        </NavigationWindow>,
    ],
    [
        "guide-navigation-drawer",
        <NavigationWindow title="Mail" width={640} height={400}>
            <DrawerApp isNarrow={false} />
        </NavigationWindow>,
    ],
    [
        "guide-navigation-split-view",
        <NavigationWindow title="Mail" width={720} height={420}>
            <SplitMail />
        </NavigationWindow>,
    ],
];

const captures = figures.flatMap(([name, element, options]) =>
    schemes.map(([scheme, colorScheme]) => ({ file: `${name}-${scheme}.png`, element, options, colorScheme })),
);

describe("documentation figures", () => {
    it.each(captures)("captures $file", async ({ file, element, options, colorScheme }) => {
        Adw.StyleManager.getDefault().setColorScheme(colorScheme);
        options?.before?.();
        await render(element, { container: rootElement });
        await options?.prepare?.();
        expect(Adw.StyleManager.getDefault().getDark()).toBe(colorScheme === Adw.ColorScheme.FORCE_DARK);
        await screen.screenshot({ scale: 2, path: `${outputDir}${file}` });
    });
});
