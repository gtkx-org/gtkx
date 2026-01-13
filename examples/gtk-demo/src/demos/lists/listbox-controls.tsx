import * as Gtk from "@gtkx/ffi/gtk";
import {
    GtkBox,
    GtkButton,
    GtkCheckButton,
    GtkFrame,
    GtkLabel,
    GtkListBox,
    GtkListBoxRow,
    GtkScale,
    GtkScrolledWindow,
    GtkSwitch,
} from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./listbox-controls.tsx?raw";

interface SettingItem {
    id: string;
    title: string;
    subtitle: string;
    type: "switch" | "checkbox" | "slider";
    value: boolean | number;
}

const ListBoxControlsDemo = () => {
    const [settings, setSettings] = useState<SettingItem[]>([
        {
            id: "notifications",
            title: "Enable Notifications",
            subtitle: "Receive alerts and updates",
            type: "switch",
            value: true,
        },
        {
            id: "dark-mode",
            title: "Dark Mode",
            subtitle: "Use dark color scheme",
            type: "switch",
            value: false,
        },
        {
            id: "auto-save",
            title: "Auto-save Documents",
            subtitle: "Automatically save changes",
            type: "checkbox",
            value: true,
        },
        {
            id: "spell-check",
            title: "Spell Check",
            subtitle: "Check spelling while typing",
            type: "checkbox",
            value: true,
        },
        {
            id: "volume",
            title: "Volume",
            subtitle: "Adjust system volume",
            type: "slider",
            value: 75,
        },
        {
            id: "brightness",
            title: "Brightness",
            subtitle: "Adjust screen brightness",
            type: "slider",
            value: 50,
        },
    ]);

    const [tasks, setTasks] = useState([
        { id: 1, text: "Review pull request", completed: false },
        { id: 2, text: "Update documentation", completed: true },
        { id: 3, text: "Fix bug #123", completed: false },
        { id: 4, text: "Write unit tests", completed: false },
        { id: 5, text: "Deploy to staging", completed: true },
    ]);

    const updateSetting = (id: string, value: boolean | number) => {
        setSettings(settings.map((s) => (s.id === id ? { ...s, value } : s)));
    };

    const toggleTask = (id: number) => {
        setTasks(tasks.map((t) => (t.id === id ? { ...t, completed: !t.completed } : t)));
    };

    const removeTask = (id: number) => {
        setTasks(tasks.filter((t) => t.id !== id));
    };

    const completedCount = tasks.filter((t) => t.completed).length;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="ListBox with Controls" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="ListBox rows can contain interactive controls like switches, checkboxes, and sliders. This pattern is common for settings panels and task lists."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Settings Panel">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkScrolledWindow heightRequest={280} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                        <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                            {settings.map((setting) => (
                                <GtkListBoxRow key={setting.id} activatable={false}>
                                    <GtkBox
                                        spacing={12}
                                        marginTop={12}
                                        marginBottom={12}
                                        marginStart={12}
                                        marginEnd={12}
                                    >
                                        <GtkBox
                                            orientation={Gtk.Orientation.VERTICAL}
                                            spacing={4}
                                            hexpand
                                            valign={Gtk.Align.CENTER}
                                        >
                                            <GtkLabel label={setting.title} halign={Gtk.Align.START} />
                                            <GtkLabel
                                                label={setting.subtitle}
                                                cssClasses={["dim-label", "caption"]}
                                                halign={Gtk.Align.START}
                                            />
                                        </GtkBox>

                                        {setting.type === "switch" && (
                                            <GtkSwitch
                                                active={setting.value as boolean}
                                                onStateSet={() => {
                                                    updateSetting(setting.id, !(setting.value as boolean));
                                                    return true;
                                                }}
                                                valign={Gtk.Align.CENTER}
                                            />
                                        )}

                                        {setting.type === "checkbox" && (
                                            <GtkCheckButton
                                                active={setting.value as boolean}
                                                onToggled={() => updateSetting(setting.id, !(setting.value as boolean))}
                                                valign={Gtk.Align.CENTER}
                                            />
                                        )}

                                        {setting.type === "slider" && (
                                            <GtkScale
                                                widthRequest={150}
                                                onValueChanged={(range: Gtk.Range) =>
                                                    updateSetting(setting.id, range.getValue())
                                                }
                                                drawValue
                                                valign={Gtk.Align.CENTER}
                                            />
                                        )}
                                    </GtkBox>
                                </GtkListBoxRow>
                            ))}
                        </GtkListBox>
                    </GtkScrolledWindow>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Task List">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`${completedCount} of ${tasks.length} tasks completed`}
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                        {tasks.map((task) => (
                            <GtkListBoxRow key={task.id} activatable={false}>
                                <GtkBox spacing={12} marginTop={8} marginBottom={8} marginStart={12} marginEnd={12}>
                                    <GtkCheckButton
                                        active={task.completed}
                                        onToggled={() => toggleTask(task.id)}
                                        valign={Gtk.Align.CENTER}
                                    />
                                    <GtkLabel
                                        label={task.text}
                                        hexpand
                                        halign={Gtk.Align.START}
                                        cssClasses={task.completed ? ["dim-label"] : []}
                                    />
                                    <GtkButton
                                        iconName="edit-delete-symbolic"
                                        cssClasses={["flat", "circular"]}
                                        onClicked={() => removeTask(task.id)}
                                        valign={Gtk.Align.CENTER}
                                    />
                                </GtkBox>
                            </GtkListBoxRow>
                        ))}
                    </GtkListBox>

                    {tasks.length === 0 && (
                        <GtkLabel label="No tasks remaining" cssClasses={["dim-label"]} marginTop={12} />
                    )}
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Patterns" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Use selectionMode=NONE for interactive rows with controls. Set activatable=false on rows that shouldn't respond to clicks. Position controls at the end of rows for consistent layout. Use GtkSwitch for on/off toggles, GtkCheckButton for multiple selections, and GtkScale for value adjustments."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const listboxControlsDemo: Demo = {
    id: "listbox-controls",
    title: "ListBox with Controls",
    description: "List rows with inline switches, checkboxes, and sliders",
    keywords: ["listbox", "settings", "switch", "checkbox", "controls", "GtkListBox", "GtkSwitch"],
    component: ListBoxControlsDemo,
    sourceCode,
};
