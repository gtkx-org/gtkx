import { t } from "@gtkx/i18n";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton, GtkToggleButton } from "@gtkx/jsx/gtk";

const PreviewToggle = () => (
    <GtkToggleButton
        iconName="view-reveal-symbolic"
        tooltipText={t("Preview (Ctrl+Shift+P)")}
        actionName="win.preview"
    />
);

const NoteMenu = () => (
    <GtkMenuButton
        iconName="view-more-symbolic"
        tooltipText={t("Note Menu")}
        menuModel={
            <GMenu
                items={[
                    {
                        section: [
                            { label: t("Rename…"), action: "win.rename-note" },
                            {
                                label: t("Move to Trash"),
                                action: "win.trash-note",
                            },
                        ],
                    },
                ]}
            />
        }
    />
);

export { NoteMenu, PreviewToggle };
