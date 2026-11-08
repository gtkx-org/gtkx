import { useTranslation } from "@gtkx/i18n";
import {
    AdwApplication,
    AdwApplicationWindow,
    AdwHeaderBar,
    AdwStatusPage,
    AdwToolbarView,
} from "@gtkx/jsx/adw";
import { quit } from "@gtkx/react";

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
                <AdwToolbarView top={<AdwHeaderBar />}>
                    <AdwStatusPage
                        iconName="document-new-symbolic"
                        title={t("No Notes")}
                        description={t(
                            "Notes are Markdown files in your notes folder",
                        )}
                    />
                </AdwToolbarView>
            </AdwApplicationWindow>
        </AdwApplication>
    );
}

export { App };
