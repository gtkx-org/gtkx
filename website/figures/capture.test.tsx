import * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { rootElement } from "@gtkx/react";
import { render, screen, waitFor } from "@gtkx/testing";
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
import { Mail as TabMail } from "./guide/navigation-tabs.js";
import { App as ListOfTasks } from "./tutorial/a-list-of-tasks/src/app.js";
import { App as TaskStore } from "./tutorial/the-task-store/src/app.js";
import { App as CompletingAndDeleting } from "./tutorial/completing-and-deleting/src/app.js";
import { App as ListsAndTheSidebar } from "./tutorial/lists-and-the-sidebar/src/app.js";
import { App as AnAdaptiveLayout } from "./tutorial/an-adaptive-layout/src/app.js";
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

async function narrowWindow(): Promise<void> {
    const window = screen.getByText("Welcome to Tasks").getRoot();

    if (!(window instanceof Gtk.Window)) {
        throw new Error("the task list has no window");
    }

    window.setDefaultSize(360, 294);
    await waitFor(() => {
        expect(window.getWidth()).toBe(360);
        expect(screen.queryByText("Shopping")).toBeNull();
    });
}

const figures: [name: string, element: ReactNode, prepare?: () => Promise<void>][] = [
    ["tutorial-your-first-window", <FirstWindow />],
    ["tutorial-a-list-of-tasks", <ListOfTasks />],
    ["tutorial-the-task-store", <TaskStore />],
    ["tutorial-completing-and-deleting", <CompletingAndDeleting />],
    ["tutorial-lists-and-the-sidebar", <ListsAndTheSidebar />],
    ["tutorial-an-adaptive-layout", <AnAdaptiveLayout />, narrowWindow],
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

const captures = figures.flatMap(([name, element, prepare]) =>
    schemes.map(([scheme, colorScheme]) => ({ file: `${name}-${scheme}.png`, element, prepare, colorScheme })),
);

describe("documentation figures", () => {
    it.each(captures)("captures $file", async ({ file, element, prepare, colorScheme }) => {
        Adw.StyleManager.getDefault().setColorScheme(colorScheme);
        await render(element, { container: rootElement });
        await prepare?.();
        expect(Adw.StyleManager.getDefault().getDark()).toBe(colorScheme === Adw.ColorScheme.FORCE_DARK);
        await screen.screenshot({ scale: 2, path: `${outputDir}${file}` });
    });
});
