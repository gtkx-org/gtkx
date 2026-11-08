import { useTranslation } from "@gtkx/i18n";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwStatusPage,
} from "@gtkx/jsx/adw";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { NoteScreen } from "./components/note-screen.js";
import { NotesScreen } from "./components/notes-screen.js";
import { Split } from "./navigation.js";
import { defaultFolder } from "./notes/files.js";
import { NotesProvider } from "./notes/notes-provider.js";

function App() {
    const { t } = useTranslation();

    return (
        <AdwApplication>
            <AdwApplicationWindow
                title={t("Notes")}
                defaultWidth={720}
                defaultHeight={480}
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
            >
                <NotesProvider folder={defaultFolder()}>
                    <NavigationContainer>
                        <Split.Navigator
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
                                options={{ title: t("Notes") }}
                            />
                            <Split.Screen
                                name="Note"
                                component={NoteScreen}
                                options={({ route }) => ({
                                    title: route.params.name,
                                })}
                            />
                        </Split.Navigator>
                    </NavigationContainer>
                </NotesProvider>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

export { App };
