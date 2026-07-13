import { Menu } from "@gtkx/components";
import { GtkMenuButton } from "@gtkx/jsx/gtk";

export const MainMenu = () => (
    <GtkMenuButton
        primary
        iconName="open-menu-symbolic"
        tooltipText="Main Menu"
        menuModel={
            <Menu
                items={[
                    {
                        section: [
                            { label: "New Task", action: "win.new" },
                            { label: "Select Tasks", action: "win.select" },
                        ],
                    },
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
