import type * as Adw from "@gtkx/gi/adw";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import { GtkListView, GtkMenuButton, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { ReactNode, Ref } from "react";
import { type Note, NoteCardComponent, NotesSidebarPage, noop, sampleNotes } from "./data.js";

export interface NotesSplitShellProps {
    headerEndExtras?: ReactNode;
    windowRef?: Ref<Adw.ApplicationWindow | null>;
}

/**
 * Notes application shell used by the navigation and dialogs chapter screenshots:
 * an Adw split view with the standard sidebar, the standard header bar (with an
 * optional extra `headerEndExtras` slot for chapter-specific toggles), and the
 * sample notes list as the content body.
 */
export const NotesSplitShell = ({ headerEndExtras, windowRef }: NotesSplitShellProps) => (
    <AdwApplicationWindow
        ref={windowRef}
        title="Notes"
        defaultWidth={900}
        defaultHeight={600}
        addAction={
            <>
                <GSimpleAction name="about" onActivate={noop} />
                <GSimpleAction name="quit" onActivate={noop} accels="<Control>q" />
            </>
        }
    >
        <AdwNavigationSplitView
            sidebarWidthFraction={0.25}
            minSidebarWidth={200}
            maxSidebarWidth={300}
            sidebar={<NotesSidebarPage />}
            content={
                <AdwNavigationPage title="All Notes">
                    <AdwToolbarView
                        addTopBar={
                            <AdwHeaderBar
                                packEnd={
                                    <>
                                        {headerEndExtras ? headerEndExtras : null}
                                        <GtkMenuButton
                                            iconName="open-menu-symbolic"
                                            menuModel={
                                                <GMenu
                                                    items={[
                                                        { label: "About Notes", action: "win.about" },
                                                        { label: "Quit", action: "win.quit" },
                                                    ]}
                                                />
                                            }
                                        />
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
                </AdwNavigationPage>
            }
        />
    </AdwApplicationWindow>
);
