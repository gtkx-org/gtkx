import { t } from "@gtkx/i18n";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

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
                            { label: t("Move to Trash"), action: "win.trash-note" },
                        ],
                    },
                ]}
            />
        }
    />
);

export { NoteMenu };
