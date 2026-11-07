import { ToastProvider } from "@gtkx/components";
import * as Adw from "@gtkx/gi/adw";
import { useTranslation } from "@gtkx/i18n";
import { AdwApplicationWindow, AdwStatusPage, AdwToastOverlay } from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { quit, useBindSetting, useSetting } from "@gtkx/react";
import { type RefObject, useEffect, useRef, useState } from "react";
import { navigationRef, openNoteName, Split } from "../navigation.js";
import { defaultFolder } from "../notes/files.js";
import { NotesProvider } from "../notes/notes-provider.js";
import { COLOR_SCHEMES, schema, useAppSettings } from "../settings.js";
import { type Dialog, Dialogs } from "./dialogs.js";
import { MainMenu } from "./main-menu.js";
import { NoteMenu } from "./note-menu.js";
import { NoteScreen } from "./note-screen.js";
import { NotesScreen } from "./notes-screen.js";
import { useNoteCommands, WindowActions } from "./window-actions.js";

const NoteNavigation = ({ onOpenNameChange }: { onOpenNameChange: (name: string | null) => void }) => {
    const { t } = useTranslation();

    return (
        <NavigationContainer ref={navigationRef} onStateChange={() => onOpenNameChange(openNoteName())}>
            <Split.Navigator
                collapseCondition="max-width: 500sp"
                sidebarWidthFraction={0.3}
                minSidebarWidth={220}
                maxSidebarWidth={320}
                contentPlaceholder={<AdwStatusPage iconName="document-edit-symbolic" title={t("No Note Selected")} />}
            >
                <Split.Screen
                    name="Notes"
                    component={NotesScreen}
                    options={{
                        title: t("Notes"),
                        headerStart: (
                            <GtkButton
                                iconName="document-new-symbolic"
                                tooltipText={t("New Note (Ctrl+N)")}
                                actionName="win.new-note"
                            />
                        ),
                        headerEnd: <MainMenu />,
                    }}
                />
                <Split.Screen
                    name="Note"
                    component={NoteScreen}
                    options={({ route }) => ({ title: route.params.name, headerEnd: <NoteMenu /> })}
                />
            </Split.Navigator>
        </NavigationContainer>
    );
};

const NotesWindow = ({ toastOverlayRef }: { toastOverlayRef: RefObject<Adw.ToastOverlay | null> }) => {
    const { t } = useTranslation();
    const settings = useAppSettings();
    const { renameNote, showError } = useNoteCommands();
    const [window, setWindow] = useState<Adw.ApplicationWindow | null>(null);
    const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
    const [openName, setOpenName] = useState<string | null>(null);

    useBindSetting({ settings, schema, key: "window-width", object: window, property: "defaultWidth" });
    useBindSetting({ settings, schema, key: "window-height", object: window, property: "defaultHeight" });

    return (
        <AdwApplicationWindow
            ref={setWindow}
            title={t("Notes")}
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
            actions={<WindowActions openName={openName} onShowDialog={setDialog} />}
        >
            <AdwToastOverlay ref={toastOverlayRef}>
                <NoteNavigation onOpenNameChange={setOpenName} />
            </AdwToastOverlay>
            <Dialogs
                dialog={dialog}
                onClose={() => setDialog({ kind: "none" })}
                onRename={(from, to) => void renameNote(from, to)}
                onError={showError}
            />
        </AdwApplicationWindow>
    );
};

const Window = () => {
    const settings = useAppSettings();
    const [folderSetting] = useSetting(settings, schema, "folder");
    const [colorScheme] = useSetting(settings, schema, "color-scheme");
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);
    const folder = folderSetting === "" ? defaultFolder() : folderSetting;

    useEffect(() => {
        Adw.StyleManager.getDefault().setColorScheme(COLOR_SCHEMES[colorScheme].value);
    }, [colorScheme]);

    return (
        <NotesProvider key={folder} folder={folder}>
            <ToastProvider overlayRef={toastOverlayRef}>
                <NotesWindow toastOverlayRef={toastOverlayRef} />
            </ToastProvider>
        </NotesProvider>
    );
};

export { Window };
