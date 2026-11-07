import { t } from "@gtkx/i18n";
import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

const MainMenu = () => (
    <GtkMenuButton
        primary
        iconName="open-menu-symbolic"
        tooltipText={t("Main Menu")}
        menuModel={
            <GMenu
                items={[
                    { section: [{ label: t("New Note"), action: "win.new-note" }] },
                    {
                        section: [
                            { label: t("Preferences"), action: "win.preferences" },
                            { label: t("Keyboard Shortcuts"), action: "win.shortcuts" },
                            { label: t("About Notes"), action: "win.about" },
                        ],
                    },
                ]}
            />
        }
    />
);

export { MainMenu };
