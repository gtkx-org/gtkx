import { ToastProvider } from "@gtkx/components";
import type * as Adw from "@gtkx/gi/adw";
import { useTranslation } from "@gtkx/i18n";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwStatusPage,
    AdwToastOverlay,
} from "@gtkx/jsx/adw";
import { GtkToggleButton } from "@gtkx/jsx/gtk";
import { NavigationContainer } from "@gtkx/navigation";
import { quit } from "@gtkx/react";
import { useRef, useState } from "react";
import { NoteScreen } from "./components/note-screen.js";
import { NotesScreen } from "./components/notes-screen.js";
import { Split } from "./navigation.js";
import { defaultFolder } from "./notes/files.js";
import { NotesProvider } from "./notes/notes-provider.js";

function App() {
    const { t } = useTranslation();
    const toastOverlayRef = useRef<Adw.ToastOverlay | null>(null);
    const [preview, setPreview] = useState(false);

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
                <ToastProvider overlayRef={toastOverlayRef}>
                    <NotesProvider folder={defaultFolder()}>
                        <AdwToastOverlay ref={toastOverlayRef}>
                            <NavigationContainer>
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
                                        options={{ title: t("Notes") }}
                                    />
                                    <Split.Screen
                                        name="Note"
                                        options={({ route }) => ({
                                            title: route.params.name,
                                            headerEnd: (
                                                <GtkToggleButton
                                                    iconName="view-reveal-symbolic"
                                                    tooltipText={t("Preview")}
                                                    active={preview}
                                                    onNotifyActive={setPreview}
                                                />
                                            ),
                                        })}
                                    >
                                        {(props) => (
                                            <NoteScreen
                                                {...props}
                                                preview={preview}
                                            />
                                        )}
                                    </Split.Screen>
                                </Split.Navigator>
                            </NavigationContainer>
                        </AdwToastOverlay>
                    </NotesProvider>
                </ToastProvider>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

export { App };
