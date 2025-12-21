import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkLabel, GtkSwitch } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const SwitchDemo = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [autoSave, setAutoSave] = useState(true);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Switch" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Settings Example" cssClasses={["heading"]} halign={Gtk.Align.START} />

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Dark Mode" hexpand halign={Gtk.Align.START} />
                    <GtkSwitch
                        active={darkMode}
                        onStateSet={(_self, state) => {
                            setDarkMode(state);
                            return true;
                        }}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Notifications" hexpand halign={Gtk.Align.START} />
                    <GtkSwitch
                        active={notifications}
                        onStateSet={(_self, state) => {
                            setNotifications(state);
                            return true;
                        }}
                    />
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Auto-save" hexpand halign={Gtk.Align.START} />
                    <GtkSwitch
                        active={autoSave}
                        onStateSet={(_self, state) => {
                            setAutoSave(state);
                            return true;
                        }}
                    />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Disabled State" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Disabled Off" hexpand halign={Gtk.Align.START} />
                    <GtkSwitch active={false} sensitive={false} />
                </GtkBox>
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkLabel label="Disabled On" hexpand halign={Gtk.Align.START} />
                    <GtkSwitch active={true} sensitive={false} />
                </GtkBox>
            </GtkBox>
        </GtkBox>
    );
};

export const switchDemo: Demo = {
    id: "switch",
    title: "Switch",
    description: "On/off toggle switches for boolean settings.",
    keywords: ["switch", "toggle", "on", "off", "GtkSwitch"],
    component: SwitchDemo,
    sourcePath: getSourcePath(import.meta.url, "switch.tsx"),
};
