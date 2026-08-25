import { ToastProvider } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";
import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage, AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { quit, useApplication, useBindSetting, useSetting } from "@gtkx/react";
import { useCallback, useEffect, useRef } from "react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useReminders } from "../hooks/use-reminders.js";
import { ALL_TASKS, navigationRef, Split } from "../navigation.js";
import { buildReminder } from "../notifications.js";
import { useStore } from "../store/index.js";
import { selectionTitle } from "../store/selectors.js";
import { applyColorScheme } from "../theme.js";
import type { Task } from "../types.js";
import { AppShortcuts } from "./app-shortcuts.js";
import { Dialogs } from "./dialogs.js";
import { MainMenu } from "./main-menu.js";
import { SearchButton } from "./search-button.js";
import { Sidebar } from "./sidebar.js";
import { TaskButtons } from "./task-buttons.js";
import { TaskFilter } from "./task-filter.js";
import { TaskScreen } from "./task-screen.js";
import { TasksScreen } from "./tasks-screen.js";
import { TaskTitle } from "./task-title.js";
import { WindowActions } from "./window-actions.js";

const NothingSelected = () => (
    <AdwStatusPage
        iconName="view-list-symbolic"
        title="Nothing Selected"
        description="Pick a list or a smart view in the sidebar"
    />
);

export const Window = () => {
    const application = useApplication();
    const lists = useStore((state) => state.lists);
    const tasks = useStore((state) => state.tasks);
    const collapsed = useStore((state) => state.collapsed);
    const setCollapsed = useStore((state) => state.setCollapsed);
    const showDialog = useStore((state) => state.showDialog);

    const [colorScheme] = useSetting(schema, "color-scheme");
    const [reminderMinutes] = useSetting(schema, "reminder-minutes");
    const windowRef = useRef<Adw.ApplicationWindow | null>(null);
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

    useBindSetting({ schema, key: "window-width", object: windowRef, property: "defaultWidth" });
    useBindSetting({ schema, key: "window-height", object: windowRef, property: "defaultHeight" });

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
                    <NavigationContainer ref={navigationRef}>
                        <Split.Navigator
                            initialRouteName="Tasks"
                            collapsed={collapsed}
                            sidebarWidthFraction={0.25}
                            minSidebarWidth={220}
                            maxSidebarWidth={300}
                            contentPlaceholder={<NothingSelected />}
                        >
                            <Split.Screen
                                name="Lists"
                                component={Sidebar}
                                options={{
                                    title: "Tasks",
                                    headerStart: (
                                        <GtkButton
                                            iconName="list-add-symbolic"
                                            tooltipText="New List"
                                            onClicked={() => showDialog("new-list")}
                                        />
                                    ),
                                }}
                            />
                            <Split.Screen
                                name="Tasks"
                                component={TasksScreen}
                                initialParams={ALL_TASKS}
                                options={({ route }) => ({
                                    title: selectionTitle(route.params, lists),
                                    headerTitle: <TaskFilter />,
                                    headerStart: (
                                        <>
                                            <GtkButton
                                                iconName="list-add-symbolic"
                                                tooltipText="New Task (Ctrl+N)"
                                                actionName="win.new"
                                            />
                                            <SearchButton />
                                        </>
                                    ),
                                    headerEnd: <MainMenu />,
                                })}
                            />
                            <Split.Screen
                                name="Task"
                                component={TaskScreen}
                                options={({ route }) => ({
                                    headerTitle: <TaskTitle id={route.params.id} />,
                                    headerEnd: <TaskButtons id={route.params.id} />,
                                })}
                            />
                        </Split.Navigator>
                    </NavigationContainer>
                </AdwToastOverlay>
                <Dialogs />
            </AdwApplicationWindow>
        </ToastProvider>
    );
};
