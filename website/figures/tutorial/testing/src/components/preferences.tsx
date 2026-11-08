import { ComboRow } from "@gtkx/components";
import type * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { t } from "@gtkx/i18n";
import {
    AdwActionRow,
    AdwPreferencesDialog,
    AdwPreferencesGroup,
    AdwPreferencesPage,
} from "@gtkx/jsx/adw";
import { GtkButton, GtkFileDialog } from "@gtkx/jsx/gtk";
import {
    createPortal,
    rootElement,
    useParentWindow,
    useSetting,
} from "@gtkx/react";
import { useState } from "react";
import { defaultFolder, displayFolder } from "../notes/files.js";
import {
    colorSchemeItems,
    schema,
    toColorScheme,
    useAppSettings,
} from "../settings.js";

const isDismissal = (error: unknown): boolean =>
    error instanceof Gtk.DialogError &&
    (error.code === Gtk.DialogError.DISMISSED ||
        error.code === Gtk.DialogError.CANCELLED);

const FolderRow = ({ onError }: { onError: (error: unknown) => void }) => {
    const settings = useAppSettings();
    const parentWindow = useParentWindow();
    const [folder, setFolder] = useSetting(settings, schema, "folder");
    const [dialog, setDialog] = useState<Gtk.FileDialog | null>(null);

    const choose = async (fileDialog: Gtk.FileDialog): Promise<void> => {
        let file: Gio.File;
        try {
            file = await fileDialog.selectFolder(parentWindow);
        } catch (error) {
            if (!isDismissal(error)) {
                onError(error);
            }

            return;
        }
        const path = file.getPath();
        if (path !== null) {
            setFolder(path);
        }
    };

    return (
        <>
            {createPortal(
                <GtkFileDialog
                    ref={setDialog}
                    title={t("Choose a Notes Folder")}
                />,
                rootElement,
            )}
            <AdwActionRow
                title={t("Notes Folder")}
                subtitle={displayFolder(
                    folder === "" ? defaultFolder() : folder,
                )}
                suffix={
                    <>
                        {folder !== "" && (
                            <GtkButton
                                iconName="edit-undo-symbolic"
                                tooltipText={t("Use the Default Folder")}
                                valign={Gtk.Align.CENTER}
                                cssClasses={["flat"]}
                                onClicked={() => setFolder("")}
                            />
                        )}
                        <GtkButton
                            iconName="folder-open-symbolic"
                            tooltipText={t("Choose Folder")}
                            valign={Gtk.Align.CENTER}
                            cssClasses={["flat"]}
                            sensitive={dialog !== null}
                            onClicked={() => {
                                if (dialog !== null) {
                                    void choose(dialog);
                                }
                            }}
                        />
                    </>
                }
            />
        </>
    );
};

type PreferencesProps = {
    onClose: () => void;
    onError: (error: unknown) => void;
};

const Preferences = ({ onClose, onError }: PreferencesProps) => {
    const settings = useAppSettings();
    const [colorScheme, setColorScheme] = useSetting(
        settings,
        schema,
        "color-scheme",
    );

    return (
        <AdwPreferencesDialog onClosed={onClose} title={t("Preferences")}>
            <AdwPreferencesPage
                title={t("General")}
                iconName="preferences-system-symbolic"
            >
                <AdwPreferencesGroup title={t("Appearance")}>
                    <ComboRow
                        title={t("Style")}
                        items={colorSchemeItems()}
                        selectedId={colorScheme}
                        onSelectionChanged={(id) => {
                            const scheme = toColorScheme(id);
                            if (scheme !== undefined) {
                                setColorScheme(scheme);
                            }
                        }}
                    />
                </AdwPreferencesGroup>
                <AdwPreferencesGroup title={t("Storage")}>
                    <FolderRow onError={onError} />
                </AdwPreferencesGroup>
            </AdwPreferencesPage>
        </AdwPreferencesDialog>
    );
};

export { Preferences };
