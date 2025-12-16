import * as Gtk from "@gtkx/ffi/gtk";
import { Box, DropDown, Label } from "@gtkx/react";
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

interface Theme {
    id: string;
    name: string;
}

const themes: Theme[] = [
    { id: "light", name: "Light" },
    { id: "dark", name: "Dark" },
    { id: "system", name: "System Default" },
];

export const DropDownDemo = () => {
    const [selectedFramework, setSelectedFramework] = useState<Framework | null>(null);
    const [selectedTheme, setSelectedTheme] = useState<Theme | null>(themes[2] ?? null);

    return (
        <Box
            orientation={Gtk.Orientation.VERTICAL}
            spacing={16}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
            hexpand
            vexpand
        >
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="DropDown" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkDropDown is a modern replacement for combo boxes. It displays a single selected item and reveals a list of options when activated. Supports search filtering and custom item display."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} vexpand>
                <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <Label label="Framework Selector" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                        <DropDown.Root
                            itemLabel={(item: Framework) => item.name}
                            onSelectionChanged={(item: Framework | null) => setSelectedFramework(item)}
                            hexpand={false}
                        >
                            {frameworks.map((fw) => (
                                <DropDown.Item key={fw.id} item={fw} />
                            ))}
                        </DropDown.Root>
                    </Box>

                    {selectedFramework && (
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} cssClasses={["card"]} marginTop={8}>
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                marginStart={12}
                                marginEnd={12}
                                marginTop={12}
                                marginBottom={12}
                            >
                                <Label
                                    label={selectedFramework.name}
                                    cssClasses={["title-3"]}
                                    halign={Gtk.Align.START}
                                />
                                <Label label={`Language: ${selectedFramework.language}`} halign={Gtk.Align.START} />
                                <Label
                                    label={selectedFramework.description}
                                    cssClasses={["dim-label"]}
                                    halign={Gtk.Align.START}
                                    wrap
                                />
                            </Box>
                        </Box>
                    )}
                </Box>

                <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                    <Label label="Theme Preference" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12} valign={Gtk.Align.CENTER}>
                        <Label label="Select theme:" />
                        <DropDown.Root
                            itemLabel={(item: Theme) => item.name}
                            onSelectionChanged={(item: Theme | null) => setSelectedTheme(item)}
                            hexpand={false}
                        >
                            {themes.map((theme) => (
                                <DropDown.Item key={theme.id} item={theme} />
                            ))}
                        </DropDown.Root>
                        {selectedTheme && (
                            <Label label={`Selected: ${selectedTheme.name}`} cssClasses={["dim-label"]} />
                        )}
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Modern replacement for GtkComboBox\n• itemLabel prop for display text\n• onSelectionChanged callback\n• Built-in keyboard navigation\n• Search filtering support"
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};
