import { execSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { css } from "@gtkx/css";
import * as Adw from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwActionRow,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationSplitView,
    AdwToggleGroup,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkListView,
    GtkMenuButton,
    GtkScrolledWindow,
    quit,
} from "@gtkx/react";
import { cleanup, render, screen, userEvent } from "@gtkx/testing";
import { useState } from "react";
import { afterEach, describe, it } from "vitest";

const noop = () => {};

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
    const buffer = Buffer.from(result.data, "base64");
    writeFileSync(resolve(IMAGES_DIR, filename), buffer);
};

const saveDisplayScreenshot = async (filename: string) => {
    ensureDarkMode();
    await new Promise((resolve) => setTimeout(resolve, 200));
    const filepath = resolve(IMAGES_DIR, filename);
    execSync(`import -window root -trim +repage png:${filepath}`);
};

interface Note {
    id: string;
    title: string;
    body: string;
    createdAt: Date;
}

const sampleNotes: Note[] = [
    {
        id: "1",
        title: "Welcome to Notes",
        body: "Your first note! Start writing here.",
        createdAt: new Date("2026-03-20"),
    },
    { id: "2", title: "Shopping List", body: "Milk, eggs, bread, butter", createdAt: new Date("2026-03-22") },
    { id: "3", title: "Meeting Notes", body: "Discussed Q2 roadmap and priorities", createdAt: new Date("2026-03-24") },
    {
        id: "4",
        title: "Book Recommendations",
        body: "The Pragmatic Programmer, Designing Data-Intensive Applications",
        createdAt: new Date("2026-03-25"),
    },
];

const noteCard = css`
    background: alpha(@card_bg_color, 0.8);
    border-radius: 12px;
    padding: 16px;

    &:hover {
        background: @card_bg_color;
    }
`;

const noteTitle = css`
    font-weight: bold;
    font-size: 14px;
`;

const notePreview = css`
    color: alpha(@window_fg_color, 0.6);
    font-size: 12px;
`;

const noteDate = css`
    color: alpha(@window_fg_color, 0.4);
    font-size: 11px;
`;

const NoteCardComponent = ({ note }: { note: Note }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} cssClasses={[noteCard]}>
        <GtkLabel label={note.title} halign={Gtk.Align.START} cssClasses={[noteTitle]} />
        <GtkLabel label={note.body} halign={Gtk.Align.START} cssClasses={[notePreview]} ellipsize={2} lines={1} />
        <GtkLabel label={note.createdAt.toLocaleDateString()} halign={Gtk.Align.START} cssClasses={[noteDate]} />
    </GtkBox>
);

const Chapter1 = () => (
    <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={500} onClose={() => {}}>
        <AdwToolbarView>
            <AdwToolbarView.AddTopBar>
                <AdwHeaderBar>
                    <AdwHeaderBar.PackStart>
                        <GtkButton iconName="list-add-symbolic" />
                    </AdwHeaderBar.PackStart>
                </AdwHeaderBar>
            </AdwToolbarView.AddTopBar>
            <GtkBox
                orientation={Gtk.Orientation.VERTICAL}
                spacing={12}
                vexpand
                halign={Gtk.Align.CENTER}
                valign={Gtk.Align.CENTER}
            >
                <GtkLabel label="No notes yet" cssClasses={["dim-label", "title-3"]} />
            </GtkBox>
        </AdwToolbarView>
    </AdwApplicationWindow>
);

const Chapter2 = () => (
    <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={500} onClose={() => {}}>
        <AdwToolbarView>
            <AdwToolbarView.AddTopBar>
                <AdwHeaderBar>
                    <AdwHeaderBar.PackStart>
                        <GtkButton iconName="list-add-symbolic" />
                    </AdwHeaderBar.PackStart>
                </AdwHeaderBar>
            </AdwToolbarView.AddTopBar>
            <GtkScrolledWindow vexpand>
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    {sampleNotes.map((note) => (
                        <NoteCardComponent key={note.id} note={note} />
                    ))}
                </GtkBox>
            </GtkScrolledWindow>
        </AdwToolbarView>
    </AdwApplicationWindow>
);

const Chapter3 = () => (
    <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={500} onClose={() => {}}>
        <AdwToolbarView>
            <AdwToolbarView.AddTopBar>
                <AdwHeaderBar>
                    <AdwHeaderBar.PackStart>
                        <GtkButton iconName="list-add-symbolic" />
                    </AdwHeaderBar.PackStart>
                </AdwHeaderBar>
            </AdwToolbarView.AddTopBar>
            <GtkScrolledWindow vexpand>
                <GtkListView
                    estimatedItemHeight={80}
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    items={sampleNotes.map((n) => ({ id: n.id, value: n }))}
                    renderItem={(note: Note) => <NoteCardComponent note={note} />}
                />
            </GtkScrolledWindow>
        </AdwToolbarView>
    </AdwApplicationWindow>
);

const Chapter4 = () => (
    <AdwApplicationWindow title="Notes" defaultWidth={600} defaultHeight={500} onClose={() => {}}>
        <AdwToolbarView>
            <AdwToolbarView.AddTopBar>
                <AdwHeaderBar>
                    <AdwHeaderBar.PackStart>
                        <GtkButton iconName="list-add-symbolic" />
                    </AdwHeaderBar.PackStart>
                    <AdwHeaderBar.PackEnd>
                        <GtkMenuButton iconName="open-menu-symbolic" name="app-menu">
                            <GtkMenuButton.MenuItem id="new" label="New Note" accels="<Control>n" onActivate={noop} />
                            <GtkMenuButton.MenuSection label="Sort">
                                <GtkMenuButton.MenuItem id="sort-title" label="By Title" onActivate={noop} />
                                <GtkMenuButton.MenuItem id="sort-date" label="By Date" onActivate={noop} />
                            </GtkMenuButton.MenuSection>
                            <GtkMenuButton.MenuSection>
                                <GtkMenuButton.MenuItem id="about" label="About Notes" onActivate={noop} />
                                <GtkMenuButton.MenuItem id="quit" label="Quit" accels="<Control>q" onActivate={noop} />
                            </GtkMenuButton.MenuSection>
                        </GtkMenuButton>
                    </AdwHeaderBar.PackEnd>
                </AdwHeaderBar>
            </AdwToolbarView.AddTopBar>
            <GtkScrolledWindow vexpand>
                <GtkListView
                    estimatedItemHeight={80}
                    selectionMode={Gtk.SelectionMode.SINGLE}
                    items={sampleNotes.map((n) => ({ id: n.id, value: n }))}
                    renderItem={(note: Note) => <NoteCardComponent note={note} />}
                />
            </GtkScrolledWindow>
        </AdwToolbarView>
    </AdwApplicationWindow>
);

const categories = [
    { id: "all", title: "All Notes", icon: "document-edit-symbolic", count: "4" },
    { id: "favorites", title: "Favorites", icon: "starred-symbolic", count: "1" },
    { id: "recent", title: "Recent", icon: "document-open-recent-symbolic", count: "3" },
    { id: "trash", title: "Trash", icon: "user-trash-symbolic", count: "0" },
];

const Chapter5 = () => (
    <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={() => {}}>
        <AdwNavigationSplitView sidebarWidthFraction={0.25} minSidebarWidth={200} maxSidebarWidth={300}>
            <AdwNavigationSplitView.Page id="sidebar" title="Notes">
                <AdwToolbarView>
                    <AdwToolbarView.AddTopBar>
                        <AdwHeaderBar>
                            <AdwHeaderBar.PackStart>
                                <GtkButton iconName="list-add-symbolic" />
                            </AdwHeaderBar.PackStart>
                        </AdwHeaderBar>
                    </AdwToolbarView.AddTopBar>
                    <GtkScrolledWindow vexpand>
                        <GtkListBox cssClasses={["navigation-sidebar"]}>
                            {categories.map((cat) => (
                                <AdwActionRow key={cat.id} title={cat.title}>
                                    <AdwActionRow.AddPrefix>
                                        <GtkImage iconName={cat.icon} />
                                    </AdwActionRow.AddPrefix>
                                    <AdwActionRow.AddSuffix>
                                        <GtkLabel label={cat.count} cssClasses={["dim-label"]} />
                                    </AdwActionRow.AddSuffix>
                                </AdwActionRow>
                            ))}
                        </GtkListBox>
                    </GtkScrolledWindow>
                </AdwToolbarView>
            </AdwNavigationSplitView.Page>
            <AdwNavigationSplitView.Page id="content" title="All Notes">
                <AdwToolbarView>
                    <AdwToolbarView.AddTopBar>
                        <AdwHeaderBar>
                            <AdwHeaderBar.PackEnd>
                                <GtkMenuButton iconName="open-menu-symbolic">
                                    <GtkMenuButton.MenuItem id="about" label="About Notes" onActivate={noop} />
                                    <GtkMenuButton.MenuItem
                                        id="quit"
                                        label="Quit"
                                        accels="<Control>q"
                                        onActivate={noop}
                                    />
                                </GtkMenuButton>
                            </AdwHeaderBar.PackEnd>
                        </AdwHeaderBar>
                    </AdwToolbarView.AddTopBar>
                    <GtkScrolledWindow vexpand>
                        <GtkListView
                            estimatedItemHeight={80}
                            selectionMode={Gtk.SelectionMode.SINGLE}
                            items={sampleNotes.map((n) => ({ id: n.id, value: n }))}
                            renderItem={(note: Note) => <NoteCardComponent note={note} />}
                        />
                    </GtkScrolledWindow>
                </AdwToolbarView>
            </AdwNavigationSplitView.Page>
        </AdwNavigationSplitView>
    </AdwApplicationWindow>
);

const Chapter6 = () => (
    <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={() => {}}>
        <AdwNavigationSplitView sidebarWidthFraction={0.25} minSidebarWidth={200} maxSidebarWidth={300}>
            <AdwNavigationSplitView.Page id="sidebar" title="Notes">
                <AdwToolbarView>
                    <AdwToolbarView.AddTopBar>
                        <AdwHeaderBar>
                            <AdwHeaderBar.PackStart>
                                <GtkButton iconName="list-add-symbolic" />
                            </AdwHeaderBar.PackStart>
                        </AdwHeaderBar>
                    </AdwToolbarView.AddTopBar>
                    <GtkScrolledWindow vexpand>
                        <GtkListBox cssClasses={["navigation-sidebar"]}>
                            {categories.map((cat) => (
                                <AdwActionRow key={cat.id} title={cat.title}>
                                    <AdwActionRow.AddPrefix>
                                        <GtkImage iconName={cat.icon} />
                                    </AdwActionRow.AddPrefix>
                                    <AdwActionRow.AddSuffix>
                                        <GtkLabel label={cat.count} cssClasses={["dim-label"]} />
                                    </AdwActionRow.AddSuffix>
                                </AdwActionRow>
                            ))}
                        </GtkListBox>
                    </GtkScrolledWindow>
                </AdwToolbarView>
            </AdwNavigationSplitView.Page>
            <AdwNavigationSplitView.Page id="content" title="All Notes">
                <AdwToolbarView>
                    <AdwToolbarView.AddTopBar>
                        <AdwHeaderBar>
                            <AdwHeaderBar.PackEnd>
                                <AdwToggleGroup
                                    toggles={[
                                        { id: "list", iconName: "view-list-symbolic" },
                                        { id: "grid", iconName: "view-grid-symbolic" },
                                    ]}
                                />
                            </AdwHeaderBar.PackEnd>
                            <AdwHeaderBar.PackEnd>
                                <GtkMenuButton iconName="open-menu-symbolic">
                                    <GtkMenuButton.MenuItem id="about" label="About Notes" onActivate={noop} />
                                    <GtkMenuButton.MenuItem
                                        id="quit"
                                        label="Quit"
                                        accels="<Control>q"
                                        onActivate={noop}
                                    />
                                </GtkMenuButton>
                            </AdwHeaderBar.PackEnd>
                        </AdwHeaderBar>
                    </AdwToolbarView.AddTopBar>
                    <GtkScrolledWindow vexpand>
                        <GtkListView
                            estimatedItemHeight={80}
                            selectionMode={Gtk.SelectionMode.SINGLE}
                            items={sampleNotes.map((n) => ({ id: n.id, value: n }))}
                            renderItem={(note: Note) => <NoteCardComponent note={note} />}
                        />
                    </GtkScrolledWindow>
                </AdwToolbarView>
            </AdwNavigationSplitView.Page>
        </AdwNavigationSplitView>
    </AdwApplicationWindow>
);

describe("Tutorial Screenshots", () => {
    afterEach(async () => {
        await cleanup();
    });

    it("captures chapter 1: window and header bar", async () => {
        await render(<Chapter1 />, { wrapper: false });
        await saveScreenshot("1-window-and-header-bar.png");
    });

    it("captures chapter 2: styling", async () => {
        await render(<Chapter2 />, { wrapper: false });
        await saveScreenshot("2-styling.png");
    });

    it("captures chapter 3: lists", async () => {
        await render(<Chapter3 />, { wrapper: false });
        await saveScreenshot("3-lists.png");
    });

    it("captures chapter 4: menus and shortcuts", async () => {
        await render(<Chapter4 />, { wrapper: false });
        const menuButton = await screen.findByName("app-menu");
        (menuButton as Gtk.MenuButton).popup();
        await saveDisplayScreenshot("4-menus-and-shortcuts.png");
    });

    it("captures chapter 5: navigation", async () => {
        await render(<Chapter5 />, { wrapper: false });
        await saveScreenshot("5-navigation.png");
    });

    it("captures chapter 6: dialogs and animations", async () => {
        await render(<Chapter6 />, { wrapper: false });
        await saveScreenshot("6-dialogs-and-animations.png");
    });
});
