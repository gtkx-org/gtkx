import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Label, Switch } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const SwitchDemo = () => {
    const [darkMode, setDarkMode] = useState(false);
    const [notifications, setNotifications] = useState(true);
    const [autoSave, setAutoSave] = useState(true);

    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Switch" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Settings Example" cssClasses={["heading"]} halign={Gtk.Align.START} />

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Dark Mode" hexpand halign={Gtk.Align.START} />
                    <Switch
                        active={darkMode}
                        onStateSet={(_self, state) => {
                            setDarkMode(state);
                            return true;
                        }}
                    />
                </Box>

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Notifications" hexpand halign={Gtk.Align.START} />
                    <Switch
                        active={notifications}
                        onStateSet={(_self, state) => {
                            setNotifications(state);
                            return true;
                        }}
                    />
                </Box>

                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Auto-save" hexpand halign={Gtk.Align.START} />
                    <Switch
                        active={autoSave}
                        onStateSet={(_self, state) => {
                            setAutoSave(state);
                            return true;
                        }}
                    />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Disabled State" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Disabled Off" hexpand halign={Gtk.Align.START} />
                    <Switch active={false} sensitive={false} />
                </Box>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Label label="Disabled On" hexpand halign={Gtk.Align.START} />
                    <Switch active={true} sensitive={false} />
                </Box>
            </Box>
        </Box>
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
