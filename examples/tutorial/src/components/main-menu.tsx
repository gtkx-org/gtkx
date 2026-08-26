import { t } from "@gtkx/i18n";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

export const MainMenu = () => (
    <GtkMenuButton
        primary
        iconName="open-menu-symbolic"
        tooltipText={t("Main Menu")}
        menuModel={
            <GMenu
                items={[
                    { section: [{ label: t("New Task"), action: "win.new" }] },
                    {
                        section: [
                            { label: t("Preferences"), action: "win.preferences" },
                            { label: t("Keyboard Shortcuts"), action: "win.shortcuts" },
                        ],
                    },
                    { section: [{ label: t("About Tasks"), action: "win.about" }] },
                ]}
            />
        }
    />
);
