import * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { AdwApplication, AdwApplicationWindow, AdwHeaderBar, AdwToolbarView } from "@gtkx/jsx/adw";
import { GtkScrolledWindow } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { rootElement } from "@gtkx/react";
import { StoryCatalog, Storybook } from "@gtkx/storybook/explorer";
import { act, render, screen, userEvent, waitFor, within } from "@gtkx/testing";
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
import { seedNotes, taggedNotes } from "./tutorial/notes.js";
import { App as NoteEditor } from "./tutorial/the-note-editor/src/app.js";
import { App as NotesFolder } from "./tutorial/the-notes-folder/src/app.js";
import { App as SavingAndWatching } from "./tutorial/saving-and-watching/src/app.js";
import { App as MarkdownPreview } from "./tutorial/the-markdown-preview/src/app.js";
import { App as FastRefresh } from "./tutorial/fast-refresh/src/app.js";
import { App as AdaptiveLayout } from "./tutorial/an-adaptive-layout/src/app.js";
import { App as SearchInAWorker } from "./tutorial/search-in-a-worker/src/app.js";
import { App as TagsAndFrontMatter } from "./tutorial/tags-and-front-matter/src/app.js";
import { App as ActionsMenusShortcuts } from "./tutorial/actions-menus-shortcuts/src/app.js";
import { App as TrashAndToasts } from "./tutorial/trash-and-toasts/src/app.js";
import { App as PreferencesAndTheming } from "./tutorial/preferences-and-theming/src/app.js";
import { App as NoteLinks } from "./tutorial/note-links/src/app.js";
import { App as Internationalization } from "./tutorial/internationalization/src/app.js";
import { App as Packaging } from "./tutorial/packaging/src/app.js";
import { restoreMessages, translateMessages } from "./tutorial/locale.js";
import * as previewStories from "./tutorial/storybook/src/preview/markdown-preview.stories.js";
import { defaultFolder } from "./tutorial/the-notes-folder/src/notes/files.js";
import { App as FirstWindow } from "./tutorial/your-first-window/src/app.js";
import { Mail as TabMail } from "./guide/navigation-tabs.js";

const storyCatalog = new StoryCatalog();

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
    after?: () => void;
};

function seedNotesWithSettings() {
    seedNotes(defaultFolder(), taggedNotes);
    const settings = Gio.Settings.new("dev.gtkx.Notes");
    const isDark = Adw.StyleManager.getDefault().getColorScheme() === Adw.ColorScheme.FORCE_DARK;
    settings.setString("color-scheme", isDark ? "dark" : "light");
    settings.setInt("window-width", 720);
    settings.setInt("window-height", 480);
}

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
        "tutorial-the-markdown-preview",
        <MarkdownPreview />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                await userEvent.click(
                    await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Website relaunch" }),
                );
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Preview" }));
                const preview = within(await screen.findByRole(Gtk.AccessibleRole.DOCUMENT, { name: "Preview" }));
                await preview.findByRole(Gtk.AccessibleRole.HEADING, { name: "Milestones" });
            },
        },
    ],
    [
        "tutorial-fast-refresh",
        <FastRefresh />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Meeting notes" }));
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Preview" }));
                const preview = within(await screen.findByRole(Gtk.AccessibleRole.DOCUMENT, { name: "Preview" }));
                await preview.findByText("Launch when the content is ready, not before.");
            },
        },
    ],
    [
        "tutorial-an-adaptive-layout",
        <AdaptiveLayout />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                const window = Gtk.Window.listToplevels().find((widget) => widget instanceof Adw.ApplicationWindow);
                window?.setDefaultSize(360, 480);
                await userEvent.click(
                    await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Website relaunch" }),
                );
                await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Back" });
                await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note text" });
            },
        },
    ],
    [
        "tutorial-search-in-a-worker",
        <SearchInAWorker />,
        {
            before: () => seedNotes(defaultFolder()),
            prepare: async () => {
                await userEvent.type(
                    await screen.findByRole(Gtk.AccessibleRole.SEARCH_BOX, { name: "Search Notes" }),
                    "kickoff",
                );
                await waitFor(() => {
                    expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Recipes" })).toBeNull();
                });
                expect(screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(2);
            },
        },
    ],
    [
        "tutorial-tags-and-front-matter",
        <TagsAndFrontMatter />,
        {
            before: () => seedNotes(defaultFolder(), taggedNotes),
            prepare: async () => {
                await userEvent.selectOptions(
                    await screen.findByRole(Gtk.AccessibleRole.COMBO_BOX, { name: "All Notes" }),
                    1,
                );
                await waitFor(() => {
                    expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Trip to Lisbon" })).toBeNull();
                });
                expect(screen.getAllByRole(Gtk.AccessibleRole.LIST_ITEM)).toHaveLength(2);
                await userEvent.click(screen.getByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book club" }));
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.TOGGLE_BUTTON, { name: "Preview" }));
                const preview = within(await screen.findByRole(Gtk.AccessibleRole.DOCUMENT, { name: "Preview" }));
                await preview.findByText("#reading");
            },
        },
    ],
    [
        "tutorial-actions-menus-shortcuts",
        <ActionsMenusShortcuts />,
        {
            before: () => seedNotes(defaultFolder(), taggedNotes),
            prepare: async () => {
                const recipes = await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Recipes" });
                await userEvent.keyboard(recipes, "{Control>}n{/Control}");
                await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Untitled" });
                await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));
                await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Keyboard Shortcuts" });
            },
        },
    ],
    [
        "tutorial-trash-and-toasts",
        <TrashAndToasts />,
        {
            before: () => seedNotes(defaultFolder(), taggedNotes),
            prepare: async () => {
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Recipes" }));
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.BUTTON, { name: "Note Menu" }));
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Move to Trash" }));
                await screen.findByText("“Recipes” moved to Trash");
                await waitFor(() => {
                    expect(screen.queryByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Recipes" })).toBeNull();
                });
            },
        },
    ],
    [
        "tutorial-preferences-and-theming",
        <PreferencesAndTheming />,
        {
            before: seedNotesWithSettings,
            prepare: async () => {
                await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
                await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Preferences" }));
                await screen.findByText("Notes Folder");
            },
        },
    ],
    [
        "tutorial-note-links",
        <NoteLinks />,
        {
            before: seedNotesWithSettings,
            prepare: async () => {
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Book club" }));
                const editor = await screen.findByRole(Gtk.AccessibleRole.TEXT_BOX, { name: "Note text" });
                await userEvent.type(editor, "[[");
                await within(editor).findByText("Trip to Lisbon");
            },
        },
    ],
    [
        "tutorial-storybook",
        <Storybook
            catalog={storyCatalog}
            applicationId="dev.gtkx.Notes.Storybook"
            initialStoryId="preview-markdown--formatting"
        />,
        {
            prepare: async () => {
                await act(() =>
                    storyCatalog.load([
                        {
                            id: "src/preview/markdown-preview.stories.tsx",
                            title: "src/preview/markdown-preview",
                            load: () => Promise.resolve(previewStories),
                        },
                    ]),
                );
                const window = Gtk.Window.listToplevels().find((widget) => widget instanceof Adw.ApplicationWindow);
                window?.setDefaultSize(880, 540);
                await screen.findByRole(Gtk.AccessibleRole.LIST_ITEM, { name: "Formatting" });
            },
        },
    ],
    [
        "tutorial-internationalization",
        <Internationalization />,
        {
            before: () => {
                translateMessages(
                    fileURLToPath(new URL("tutorial/internationalization/po/fr.po", import.meta.url)),
                    "fr",
                    "fr_FR.UTF-8",
                );
                seedNotesWithSettings();
            },
            prepare: async () => {
                await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
                await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Menu principal" }));
                await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "Préférences" });
            },
            after: restoreMessages,
        },
    ],
    [
        "tutorial-packaging",
        <Packaging />,
        {
            before: seedNotesWithSettings,
            prepare: async () => {
                await screen.findAllByRole(Gtk.AccessibleRole.LIST_ITEM);
                await userEvent.click(screen.getByRole(Gtk.AccessibleRole.BUTTON, { name: "Main Menu" }));
                await userEvent.click(await screen.findByRole(Gtk.AccessibleRole.MENU_ITEM, { name: "About Notes" }));
                await screen.findByText("1.0.0");
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
        try {
            options?.before?.();
            await render(element, { container: rootElement });
            await options?.prepare?.();
            expect(Adw.StyleManager.getDefault().getDark()).toBe(colorScheme === Adw.ColorScheme.FORCE_DARK);
            await screen.screenshot({ scale: 2, path: `${outputDir}${file}` });
        } finally {
            options?.after?.();
        }
    });
});
