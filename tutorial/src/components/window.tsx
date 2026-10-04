import type { RefObject } from "react";
import { ToastProvider } from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import { useTranslation } from "@gtkx/i18n";
import { AdwApplicationWindow, AdwBreakpoint, AdwStatusPage, AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { quit, useBindSetting, useSetting } from "@gtkx/react";
import { useEffect, useRef, useState } from "react";
import schema from "../../data/com.gtkx.tutorial.gschema.xml";
import { useReminders } from "../hooks/use-reminders.js";
import { ALL_TASKS, navigationRef, openPendingTask, Split } from "../navigation.js";
import { ReminderNotification } from "../notifications.js";
import { useStore } from "../store/index.js";
import { selectionTitle } from "../store/selectors.js";
import { applyColorScheme } from "../theme.js";
import { AppShortcuts } from "./app-shortcuts.js";
import { Dialogs } from "./dialogs.js";
import { MainMenu } from "./main-menu.js";
import { SearchButton } from "./search-button.js";
import { useAppSettings } from "./settings.js";
import { Sidebar } from "./sidebar.js";
import { TaskButtons } from "./task-buttons.js";
import { TaskFilter } from "./task-filter.js";
import { TaskScreen } from "./task-screen.js";
import { TaskTitle } from "./task-title.js";
import { TasksScreen } from "./tasks-screen.js";
import { WindowActions } from "./window-actions.js";

const NothingSelected = () => {
    const { t } = useTranslation();

    return (
        <AdwStatusPage
            iconName="view-list-symbolic"
            title={t("Nothing Selected")}
            description={t("Pick a list or a smart view in the sidebar")}
        />
    );
};

const NewListButton = () => {
    const { t } = useTranslation();
    const showDialog = useStore((state) => state.showDialog);

    return (
        <GtkButton
            iconName="list-add-symbolic"
            tooltipText={t("New List")}
            onClicked={() => {
                showDialog("new-list");
            }}
        />
    );
};

const NewTaskButtons = () => {
    const { t } = useTranslation();

    return (
        <>
            <GtkButton
                iconName="list-add-symbolic"
                tooltipText={t("New Task (Ctrl+N)")}
                actionName="win.new"
            />
            <SearchButton />
        </>
    );
};

const TaskNavigation = () => {
    const { t } = useTranslation();
    const lists = useStore((state) => state.lists);
    const isCollapsed = useStore((state) => state.collapsed);

    return (
        <NavigationContainer ref={navigationRef} onReady={openPendingTask}>
            <Split.Navigator
                initialRouteName="Tasks"
                collapsed={isCollapsed}
                sidebarWidthFraction={0.25}
                minSidebarWidth={220}
                maxSidebarWidth={300}
                contentPlaceholder={<NothingSelected />}
            >
                <Split.Screen
                    name="Lists"
                    component={Sidebar}
                    options={{ title: t("Tasks"), headerStart: <NewListButton /> }}
                />
                <Split.Screen
                    name="Tasks"
                    component={TasksScreen}
                    initialParams={ALL_TASKS}
                    options={({ route }) => ({
                        title: selectionTitle(route.params, lists),
                        headerTitle: <TaskFilter />,
                        headerStart: <NewTaskButtons />,
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
    );
};

const WindowContent = ({ toastOverlayRef }: { toastOverlayRef: RefObject<Adw.ToastOverlay | null> }) => {
    const { t } = useTranslation();
    const setCollapsed = useStore((state) => state.setCollapsed);

    const settings = useAppSettings();
    const [colorScheme] = useSetting(settings, schema, "color-scheme");
    const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);

    useBindSetting({ settings, schema, key: "window-width", object: window, property: "defaultWidth" });
    useBindSetting({ settings, schema, key: "window-height", object: window, property: "defaultHeight" });

    useEffect(() => {
        applyColorScheme(colorScheme);
    }, [colorScheme]);

    return (
        <AdwApplicationWindow
            ref={setWindow}
            title={t("Tasks")}
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
            breakpoints={(
                <AdwBreakpoint
                    condition={Adw.BreakpointCondition.parse("max-width: 500sp")}
                    onApply={() => {
                        setCollapsed(true);
                    }}
                    onUnapply={() => {
                        setCollapsed(false);
                    }}
                />
            )}
            actions={<WindowActions />}
            controllers={<AppShortcuts />}
        >
            <AdwToastOverlay ref={toastOverlayRef}>
                <TaskNavigation />
            </AdwToastOverlay>
            <Dialogs />
        </AdwApplicationWindow>
    );
};

const Window = () => {
    const tasks = useStore((state) => state.tasks);
    const settings = useAppSettings();
    const [reminderMinutes] = useSetting(settings, schema, "reminder-minutes");
    const reminders = useReminders(tasks, reminderMinutes);
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

    return (
        <ToastProvider overlayRef={toastOverlayRef}>
            {reminders.map((reminder) => (
                <ReminderNotification key={`${reminder.id}:${reminder.due}`} {...reminder} />
            ))}
            <WindowContent toastOverlayRef={toastOverlayRef} />
        </ToastProvider>
    );
};

export {
    Window,
};
