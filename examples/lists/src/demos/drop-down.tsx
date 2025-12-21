import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkDropDown, GtkLabel, SimpleListItem } from "@gtkx/react";
import { useState } from "react";

interface Framework {
    id: string;
    name: string;
    language: string;
    description: string;
}

const frameworks: Framework[] = [
    { id: "react", name: "React", language: "JavaScript", description: "A library for building user interfaces" },
    { id: "vue", name: "Vue", language: "JavaScript", description: "The progressive JavaScript framework" },
    {
        id: "angular",
        name: "Angular",
        language: "TypeScript",
        description: "Platform for building mobile and desktop apps",
    },
    { id: "svelte", name: "Svelte", language: "JavaScript", description: "Cybernetically enhanced web apps" },
    { id: "solid", name: "SolidJS", language: "JavaScript", description: "Simple and performant reactivity" },
    { id: "gtk", name: "GTK", language: "C", description: "Cross-platform toolkit for creating GUIs" },
    { id: "qt", name: "Qt", language: "C++", description: "Cross-platform application framework" },
    { id: "flutter", name: "Flutter", language: "Dart", description: "Build apps for any screen" },
];

const frameworksById = new Map(frameworks.map((fw) => [fw.id, fw]));

interface Theme {
    id: string;
    name: string;
}

const themes: Theme[] = [
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
    { id: "system", name: "System Default" },
];

const themesById = new Map(themes.map((theme) => [theme.id, theme]));

export const DropDownDemo = () => {
    const [selectedFrameworkId, setSelectedFrameworkId] = useState<string | null>(null);
    const [selectedThemeId, setSelectedThemeId] = useState<string | null>("system");

    const selectedFramework = selectedFrameworkId ? frameworksById.get(selectedFrameworkId) : null;
    const selectedTheme = selectedThemeId ? themesById.get(selectedThemeId) : null;

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="DropDown" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkDropDown is a modern replacement for combo boxes. It displays a single selected item and reveals a list of options when activated. Supports search filtering and custom item display."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} vexpand>
                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <GtkLabel label="Framework Selector" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <GtkDropDown onSelectionChanged={setSelectedFrameworkId} hexpand={false}>
                            {frameworks.map((fw) => (
                                <SimpleListItem key={fw.id} id={fw.id} value={fw.name} />
                            ))}
                        </GtkDropDown>
                    </GtkBox>

                    {selectedFramework && (
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={["card"]} marginTop={8}>
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <GtkLabel
                                    label={selectedFramework.name}
                                    cssClasses={["title-3"]}
                                    halign={Gtk.Align.START}
                                />
                                <GtkLabel label={`Language: ${selectedFramework.language}`} halign={Gtk.Align.START} />
                                <GtkLabel
                                    label={selectedFramework.description}
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                    wrap
                                />
                            </GtkBox>
                        </GtkBox>
                    )}
                </GtkBox>

                <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <GtkLabel label="Theme Preference" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12} valign={Gtk.Align.CENTER}>
                        Select theme:
                        <GtkDropDown selectedId="system" onSelectionChanged={setSelectedThemeId} hexpand={false}>
                            {themes.map((theme) => (
                                <SimpleListItem key={theme.id} id={theme.id} value={theme.name} />
                            ))}
                        </GtkDropDown>
                        {selectedTheme && (
                            <GtkLabel label={`Selected: ${selectedTheme.name}`} cssClasses={["dim-label"]} />
                        )}
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={
                        "• Modern replacement for GtkComboBox\n• id and label props for items\n• onSelectionChanged callback returns selected ID\n• Built-in keyboard navigation\n• Search filtering support"
                    }
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </GtkBox>
        </GtkBox>
    );
};
