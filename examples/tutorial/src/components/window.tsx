import { ToastProvider } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";
import {
    AdwApplicationWindow,
    AdwBreakpoint,
    AdwHeaderBar,
    AdwNavigationPage,
    AdwNavigationSplitView,
    AdwToastOverlay,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { quit, useApplication, useBindSetting, useSetting } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import schema from "#data/com.gtkx.tutorial.gschema.xml";
import { useReminders } from "../hooks/use-reminders.js";
import { buildReminder } from "../notifications.js";
import { useStore } from "../store/index.js";
import { selectionTitle } from "../store/selectors.js";
import { applyColorScheme } from "../theme.js";
import type { Task } from "../types.js";
import { AppShortcuts } from "./app-shortcuts.js";
import { ContentPane } from "./content-pane.js";
import { Dialogs } from "./dialogs.js";
import { Sidebar } from "./sidebar.js";
import { WindowActions } from "./window-actions.js";

export const Window = () => {
    const application = useApplication();
    const lists = useStore((state) => state.lists);
    const tasks = useStore((state) => state.tasks);
    const selection = useStore((state) => state.selection);
    const collapsed = useStore((state) => state.collapsed);
    const showContent = useStore((state) => state.showContent);
    const setCollapsed = useStore((state) => state.setCollapsed);
    const setShowContent = useStore((state) => state.setShowContent);
    const showDialog = useStore((state) => state.showDialog);

    const [colorScheme] = useSetting(schema, "color-scheme");
    const [reminderMinutes] = useSetting(schema, "reminder-minutes");
    const windowRef = useRef<Adw.ApplicationWindow | null>(null);
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

    useBindSetting(schema, "window-width", windowRef, "defaultWidth");
    useBindSetting(schema, "window-height", windowRef, "defaultHeight");

    useEffect(() => {
        applyColorScheme(colorScheme);
    }, [colorScheme]);

    const sendReminder = useCallback(
        (task: Task) => application.sendNotification(task.id, buildReminder(task)),
        [application],
    );
    useReminders(tasks, reminderMinutes, sendReminder);

    return (
        <ToastProvider overlayRef={toastOverlayRef}>
            <AdwApplicationWindow
                ref={windowRef}
                title="Tasks"
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
                breakpoints={
                    <AdwBreakpoint
                        condition={Adw.BreakpointCondition.parse("max-width: 500sp")}
                        onApply={() => setCollapsed(true)}
                        onUnapply={() => setCollapsed(false)}
                    />
                }
                actions={<WindowActions />}
                controllers={<AppShortcuts />}
            >
                <AdwToastOverlay ref={toastOverlayRef}>
                    <AdwNavigationSplitView
                        collapsed={collapsed}
                        showContent={showContent}
                        onNotifyShowContent={(value) => setShowContent(value ?? false)}
                        sidebarWidthFraction={0.25}
                        minSidebarWidth={220}
                        maxSidebarWidth={300}
                        sidebar={
                            <AdwNavigationPage title="Tasks">
                                <AdwToolbarView
                                    topBar={
                                        <AdwHeaderBar
                                            start={
                                                <GtkButton
                                                    iconName="list-add-symbolic"
                                                    tooltipText="New List"
                                                    onClicked={() => showDialog("new-list")}
                                                />
                                            }
                                        />
                                    }
                                >
                                    <Sidebar />
                                </AdwToolbarView>
                            </AdwNavigationPage>
                        }
                        content={
                            <AdwNavigationPage title={selectionTitle(selection, lists)}>
                                <ContentPane />
                            </AdwNavigationPage>
                        }
                    />
                </AdwToastOverlay>
                <Dialogs />
            </AdwApplicationWindow>
        </ToastProvider>
    );
};
