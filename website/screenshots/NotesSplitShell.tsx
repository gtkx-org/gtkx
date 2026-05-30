import * as Gtk from "@gtkx/ffi/gtk";
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationSplitView,
    AdwToolbarView,
    GtkListView,
    GtkMenuButton,
    GtkScrolledWindow,
} from "@gtkx/react";
import type { ReactNode } from "react";
import { type Note, NoteCardComponent, NotesSidebarPage, noop, sampleNotes } from "./data";

export interface NotesSplitShellProps {
    headerEndExtras?: ReactNode;
}

/**
 * Notes application shell used by the navigation and dialogs chapter screenshots:
 * an Adw split view with the standard sidebar, the standard header bar (with an
 * optional extra `headerEndExtras` slot for chapter-specific toggles), and the
 * sample notes list as the content body.
 */
export const NotesSplitShell = ({ headerEndExtras }: NotesSplitShellProps) => (
    <AdwApplicationWindow title="Notes" defaultWidth={900} defaultHeight={600} onClose={noop}>
        <AdwNavigationSplitView sidebarWidthFraction={0.25} minSidebarWidth={200} maxSidebarWidth={300}>
            <NotesSidebarPage />
            <AdwNavigationSplitView.Page id="content" title="All Notes">
                <AdwToolbarView
                    addTopBar={
                        <AdwHeaderBar
                            packEnd={
                                <>
                                    {headerEndExtras ? headerEndExtras : null}
                                    <GtkMenuButton iconName="open-menu-symbolic">
                                        <GtkMenuButton.MenuItem id="about" label="About Notes" onActivate={noop} />
                                        <GtkMenuButton.MenuItem
                                            id="quit"
                                            label="Quit"
                                            accels="<Control>q"
                                            onActivate={noop}
                                        />
                                    </GtkMenuButton>
                                </>
                            }
                        />
                    }
                >
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
