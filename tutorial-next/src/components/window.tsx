import { t, useTranslation } from "@gtkx/i18n";
import { AdwApplicationWindow, AdwStatusPage } from "@gtkx/jsx/adw";
import { GSimpleAction } from "@gtkx/jsx/gio";
import { GtkButton } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { quit, useSetting } from "@gtkx/react";
import { navigationRef, openNote, Split } from "../navigation.js";
import { defaultFolder, freeName } from "../notes/files.js";
import { NotesProvider, useNotes } from "../notes/notes-provider.js";
import { schema, useAppSettings } from "../settings.js";
import { NoteScreen } from "./note-screen.js";
import { NotesScreen } from "./notes-screen.js";

const WindowActions = () => {
    const { notes, create } = useNotes();

    const newNote = async (): Promise<void> => {
        const name = freeName(new Set(notes?.keys()), t("Untitled"));
        await create(name, "");
        openNote(name);
    };

    return <GSimpleAction name="new-note" enabled={notes !== null} onActivate={() => void newNote()} />;
};

const NotesWindow = () => {
    const { t } = useTranslation();

    return (
        <AdwApplicationWindow
            title={t("Notes")}
            defaultWidth={960}
            defaultHeight={640}
            widthRequest={360}
            heightRequest={294}
            onCloseRequest={() => quit()}
            actions={<WindowActions />}
        >
            <NavigationContainer ref={navigationRef}>
                <Split.Navigator
                    collapseCondition="max-width: 500sp"
                    sidebarWidthFraction={0.3}
                    minSidebarWidth={220}
                    maxSidebarWidth={320}
                    contentPlaceholder={
                        <AdwStatusPage iconName="document-edit-symbolic" title={t("No Note Selected")} />
                    }
                >
                    <Split.Screen
                        name="Notes"
                        component={NotesScreen}
                        options={{
                            title: t("Notes"),
                            headerEnd: (
                                <GtkButton
                                    iconName="document-new-symbolic"
                                    tooltipText={t("New Note (Ctrl+N)")}
                                    actionName="win.new-note"
                                />
                            ),
                        }}
                    />
                    <Split.Screen
                        name="Note"
                        component={NoteScreen}
                        options={({ route }) => ({ title: route.params.name })}
                    />
                </Split.Navigator>
            </NavigationContainer>
        </AdwApplicationWindow>
    );
};

const Window = () => {
    const settings = useAppSettings();
    const [folderSetting] = useSetting(settings, schema, "folder");
    const folder = folderSetting === "" ? defaultFolder() : folderSetting;

    return (
        <NotesProvider key={folder} folder={folder}>
            <NotesWindow />
        </NotesProvider>
    );
};

export { Window };
