import { ToastProvider } from "@gtkx/components";
import type * as Adw from "@gtkx/gi/adw";
import { useTranslation } from "@gtkx/i18n";
import {
    AdwApplicationWindow,
    AdwStatusPage,
    AdwToastOverlay,
} from "@gtkx/jsx/adw";
import { GtkButton } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { type RefObject, useRef, useState } from "react";
import { navigationRef, openNoteName, Split } from "../navigation.js";
import { defaultFolder } from "../notes/files.js";
import { NotesProvider } from "../notes/notes-provider.js";
import { type Dialog, Dialogs } from "./dialogs.js";
import { MainMenu } from "./main-menu.js";
import { NoteMenu, PreviewToggle } from "./note-menu.js";
import { NoteScreen } from "./note-screen.js";
import { NotesScreen, NotesTitle } from "./notes-screen.js";
import { useNoteCommands, WindowActions } from "./window-actions.js";

const NoteNavigation = ({
    preview,
    onOpenNameChange,
}: {
    preview: boolean;
    onOpenNameChange: (name: string | null) => void;
}) => {
    const { t } = useTranslation();

    return (
        <NavigationContainer
            ref={navigationRef}
            onStateChange={() => onOpenNameChange(openNoteName())}
        >
            <Split.Navigator
                collapseCondition="max-width: 500sp"
                sidebarWidthFraction={0.3}
                minSidebarWidth={220}
                maxSidebarWidth={320}
                contentPlaceholder={
                    <AdwStatusPage
                        iconName="document-edit-symbolic"
                        title={t("No Note Selected")}
                    />
                }
            >
                <Split.Screen
                    name="Notes"
                    component={NotesScreen}
                    options={{
                        title: t("Notes"),
                        headerTitle: <NotesTitle />,
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
                    options={({ route }) => ({
                        title: route.params.name,
                        headerEnd: (
                            <>
                                <NoteMenu />
                                <PreviewToggle />
                            </>
                        ),
                    })}
                >
                    {(props) => <NoteScreen {...props} preview={preview} />}
                </Split.Screen>
            </Split.Navigator>
        </NavigationContainer>
    );
};

const NotesWindow = ({
    toastOverlayRef,
}: {
    toastOverlayRef: RefObject<Adw.ToastOverlay | null>;
}) => {
    const { t } = useTranslation();
    const [dialog, setDialog] = useState<Dialog>({ kind: "none" });
    const { renameNote } = useNoteCommands();
    const [openName, setOpenName] = useState<string | null>(null);
    const [preview, setPreview] = useState(false);

    return (
        <AdwApplicationWindow
            title={t("Notes")}
            defaultWidth={720}
            defaultHeight={480}
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
            actions={
                <WindowActions
                    openName={openName}
                    preview={preview}
                    onPreviewChange={setPreview}
                    onShowDialog={setDialog}
                />
            }
        >
            <AdwToastOverlay ref={toastOverlayRef}>
                <NoteNavigation
                    preview={preview}
                    onOpenNameChange={setOpenName}
                />
            </AdwToastOverlay>
            <Dialogs
                dialog={dialog}
                onClose={() => setDialog({ kind: "none" })}
                onRename={(from, to) => void renameNote(from, to)}
            />
        </AdwApplicationWindow>
    );
};

const Window = () => {
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);

    return (
        <ToastProvider overlayRef={toastOverlayRef}>
            <NotesProvider folder={defaultFolder()}>
                <NotesWindow toastOverlayRef={toastOverlayRef} />
            </NotesProvider>
        </ToastProvider>
    );
};

export { Window };
