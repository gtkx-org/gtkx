import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwActionRow,
    AdwHeaderBar,
    AdwNavigationSplitView,
    AdwToolbarView,
    GtkBox,
    GtkButton,
    GtkImage,
    GtkLabel,
    GtkListBox,
    GtkScrolledWindow,
} from "@gtkx/react";

export interface Note {
    id: string;
    title: string;
    body: string;
    createdAt: Date;
}

export const sampleNotes: Note[] = [
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

export const categories = [
    { id: "all", title: "All Notes", icon: "document-edit-symbolic", count: "4" },
    { id: "favorites", title: "Favorites", icon: "starred-symbolic", count: "1" },
    { id: "recent", title: "Recent", icon: "document-open-recent-symbolic", count: "3" },
    { id: "trash", title: "Trash", icon: "user-trash-symbolic", count: "0" },
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

export const NoteCardComponent = ({ note }: { note: Note }) => (
    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} cssClasses={[noteCard]}>
        <GtkLabel label={note.title} halign={Gtk.Align.START} cssClasses={[noteTitle]} />
        <GtkLabel label={note.body} halign={Gtk.Align.START} cssClasses={[notePreview]} ellipsize={2} lines={1} />
        <GtkLabel label={note.createdAt.toLocaleDateString()} halign={Gtk.Align.START} cssClasses={[noteDate]} />
    </GtkBox>
);

export const noop = () => {};

export const NotesSidebarPage = () => (
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
);
