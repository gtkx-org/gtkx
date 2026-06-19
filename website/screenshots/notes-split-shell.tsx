import type * as Adw from "@gtkx/gi/adw";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GMenu, GSimpleAction } from "@gtkx/jsx/gio";
import { GtkListView, GtkMenuButton, GtkScrolledWindow } from "@gtkx/jsx/gtk";
import type { ActionAccel } from "@gtkx/react";
import { type ReactNode, type Ref, useState } from "react";
import { type Note, NoteCardComponent, NotesSidebarPage, noop, sampleNotes } from "./data.js";

export interface NotesSplitShellProps {
    headerEndExtras?: ReactNode;
    windowRef?: Ref<Adw.ApplicationWindow | null>;
}

const ACTION_ACCELS: ActionAccel[] = [{ action: "win.quit", accels: ["<Control>q"] }];

let nextAppId = 0;

/**
 * Notes application shell used by the navigation and dialogs chapter screenshots:
 * an Adw split view with the standard sidebar, the standard header bar (with an
 * optional extra `headerEndExtras` slot for chapter-specific toggles), and the
 * sample notes list as the content body.
 */
export const NotesSplitShell = ({ headerEndExtras, windowRef }: NotesSplitShellProps) => {
    const [applicationId] = useState(() => `org.gtkx.notessplitshell${nextAppId++}`);
    return (
        <AdwApplication
            applicationId={applicationId}
            flags={Gio.ApplicationFlags.NON_UNIQUE}
            actionAccels={ACTION_ACCELS}
        >
            <AdwApplicationWindow
                ref={windowRef}
                title="Notes"
                defaultWidth={900}
                defaultHeight={600}
                addAction={
                    <>
                        <GSimpleAction name="about" onActivate={noop} />
                        <GSimpleAction name="quit" onActivate={noop} />
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
        </AdwApplication>
    );
};
