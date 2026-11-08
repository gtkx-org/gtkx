import { useTranslation } from "@gtkx/i18n";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";
import { NotesScreen } from "./components/notes-screen.js";
import { defaultFolder } from "./notes/files.js";
import { NotesProvider } from "./notes/notes-provider.js";

function App() {
    const { t } = useTranslation();

    return (
        <AdwApplication>
            <AdwApplicationWindow
                title={t("Notes")}
                widthRequest={360}
                heightRequest={294}
                onCloseRequest={() => quit()}
            >
                <NotesProvider folder={defaultFolder()}>
                    <AdwToolbarView top={<AdwHeaderBar />}>
                        <NotesScreen />
                    </AdwToolbarView>
                </NotesProvider>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

export { App };
