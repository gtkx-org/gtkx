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
                    {
                        section: [
                            { label: "New Note", action: "win.new" },
                            { label: "Show Preview", action: "win.preview" },
                        ],
                    },
                    {
                        section: [
                            {
                                label: "Keyboard Shortcuts",
                                action: "win.shortcuts",
                            },
                            { label: "About Notes", action: "win.about" },
                        ],
                    },
                ]}
            />
        }
    />
);
