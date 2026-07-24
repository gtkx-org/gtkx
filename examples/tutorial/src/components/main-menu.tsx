import { GMenu } from "@gtkx/jsx/gio";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

export const MainMenu = () => (
    <GtkMenuButton
        primary
        iconName="open-menu-symbolic"
        tooltipText="Main Menu"
        menuModel={
            <GMenu
                items={[
                    { section: [{ label: "New Task", action: "win.new" }] },
                    {
                        section: [
                            { label: "Preferences", action: "win.preferences" },
                            { label: "Keyboard Shortcuts", action: "win.shortcuts" },
                        ],
                    },
                    { section: [{ label: "About Tasks", action: "win.about" }] },
                ]}
            />
        }
    />
);
