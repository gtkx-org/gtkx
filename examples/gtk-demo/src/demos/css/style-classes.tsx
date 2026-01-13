import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkListBox, GtkListBoxRow, GtkScrolledWindow } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./style-classes.tsx?raw";

interface StyleClassInfo {
    name: string;
    description: string;
    category: string;
}

const STYLE_CLASSES: StyleClassInfo[] = [
    { name: "title-1", description: "Largest title (36px)", category: "Typography" },
    { name: "title-2", description: "Section title (24px)", category: "Typography" },
    { name: "title-3", description: "Subsection title (20px)", category: "Typography" },
    { name: "title-4", description: "Small title (16px)", category: "Typography" },
    { name: "heading", description: "Bold heading text", category: "Typography" },
    { name: "body", description: "Body text style", category: "Typography" },
    { name: "caption", description: "Small caption text", category: "Typography" },
    { name: "caption-heading", description: "Caption with bold", category: "Typography" },
    { name: "monospace", description: "Monospace font", category: "Typography" },
    { name: "dim-label", description: "Dimmed/secondary text", category: "Typography" },
    { name: "numeric", description: "Tabular numbers", category: "Typography" },

    { name: "suggested-action", description: "Primary action button", category: "Buttons" },
    { name: "destructive-action", description: "Dangerous action button", category: "Buttons" },
    { name: "flat", description: "Borderless button", category: "Buttons" },
    { name: "raised", description: "Elevated button", category: "Buttons" },
    { name: "circular", description: "Round button", category: "Buttons" },
    { name: "pill", description: "Pill-shaped button", category: "Buttons" },
    { name: "opaque", description: "Opaque background", category: "Buttons" },

    { name: "card", description: "Rounded card container", category: "Containers" },
    { name: "boxed-list", description: "Rounded list container", category: "Containers" },
    { name: "frame", description: "Simple frame border", category: "Containers" },
    { name: "view", description: "Content view background", category: "Containers" },
    { name: "background", description: "Window background", category: "Containers" },
    { name: "sidebar", description: "Sidebar styling", category: "Containers" },
    { name: "navigation-sidebar", description: "Navigation sidebar", category: "Containers" },

    { name: "accent", description: "Accent color styling", category: "Colors" },
    { name: "success", description: "Success/positive color", category: "Colors" },
    { name: "warning", description: "Warning color", category: "Colors" },
    { name: "error", description: "Error/negative color", category: "Colors" },

    { name: "osd", description: "On-screen display style", category: "Special" },
    { name: "linked", description: "Connected button group", category: "Special" },
    { name: "selection-mode", description: "Selection mode styling", category: "Special" },
    { name: "activatable", description: "Hover/active states", category: "Special" },
];

const StyleClassesDemo = () => {
    const [selectedCategory, setSelectedCategory] = useState("Typography");

    const categories = [...new Set(STYLE_CLASSES.map((c) => c.category))];
    const filteredClasses = STYLE_CLASSES.filter((c) => c.category === selectedCategory);

    const renderPreview = (styleClass: StyleClassInfo) => {
        switch (styleClass.category) {
            case "Typography":
                return <GtkLabel label="Sample Text" cssClasses={[styleClass.name]} />;

            case "Buttons":
                return (
                    <GtkButton
                        label={styleClass.name === "circular" ? "" : "Button"}
                        iconName={styleClass.name === "circular" ? "starred-symbolic" : undefined}
                        cssClasses={[styleClass.name]}
                        onClicked={() => {}}
                    />
                );

            case "Containers":
                return (
                    <GtkBox
                        cssClasses={[styleClass.name]}
                        orientation={Gtk.Orientation.VERTICAL}
                        marginTop={8}
                        marginBottom={8}
                        marginStart={8}
                        marginEnd={8}
                    >
                        <GtkLabel label="Container" marginTop={8} marginBottom={8} marginStart={12} marginEnd={12} />
                    </GtkBox>
                );

            case "Colors":
                return (
                    <GtkBox
                        cssClasses={[styleClass.name]}
                        orientation={Gtk.Orientation.VERTICAL}
                        marginTop={4}
                        marginBottom={4}
                        marginStart={8}
                        marginEnd={8}
                    >
                        <GtkLabel
                            label={styleClass.name}
                            marginTop={8}
                            marginBottom={8}
                            marginStart={16}
                            marginEnd={16}
                        />
                    </GtkBox>
                );

            case "Special":
                if (styleClass.name === "linked") {
                    return (
                        <GtkBox cssClasses={["linked"]}>
                            <GtkButton label="First" onClicked={() => {}} />
                            <GtkButton label="Second" onClicked={() => {}} />
                            <GtkButton label="Third" onClicked={() => {}} />
                        </GtkBox>
                    );
                }
                return (
                    <GtkBox
                        cssClasses={[styleClass.name]}
                        orientation={Gtk.Orientation.VERTICAL}
                        marginTop={4}
                        marginBottom={4}
                        marginStart={8}
                        marginEnd={8}
                    >
                        <GtkLabel label="Widget" marginTop={8} marginBottom={8} marginStart={12} marginEnd={12} />
                    </GtkBox>
                );

            default:
                return <GtkLabel label={styleClass.name} cssClasses={[styleClass.name]} />;
        }
    };

    return (
        <GtkBox
            orientation={Gtk.Orientation.VERTICAL}
            spacing={24}
            marginStart={20}
            marginEnd={20}
            marginTop={20}
            marginBottom={20}
        >
            <GtkLabel label="Adwaita CSS Classes" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Libadwaita provides many built-in CSS classes for consistent styling. Use the cssClasses prop to apply these to any widget. These classes automatically adapt to light/dark themes."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                {categories.map((category) => (
                    <GtkButton
                        key={category}
                        label={category}
                        cssClasses={selectedCategory === category ? ["suggested-action"] : []}
                        onClicked={() => setSelectedCategory(category)}
                    />
                ))}
            </GtkBox>

            <GtkFrame>
                <GtkScrolledWindow heightRequest={350} hscrollbarPolicy={Gtk.PolicyType.NEVER}>
                    <GtkListBox selectionMode={Gtk.SelectionMode.NONE} cssClasses={["boxed-list"]}>
                        {filteredClasses.map((styleClass) => (
                            <GtkListBoxRow key={styleClass.name} activatable={false}>
                                <GtkBox spacing={16} marginTop={12} marginBottom={12} marginStart={16} marginEnd={16}>
                                    <GtkBox orientation={Gtk.Orientation.VERTICAL} hexpand valign={Gtk.Align.CENTER}>
                                        <GtkLabel
                                            label={styleClass.name}
                                            cssClasses={["monospace", "heading"]}
                                            halign={Gtk.Align.START}
                                        />
                                        <GtkLabel
                                            label={styleClass.description}
                                            cssClasses={["dim-label", "caption"]}
                                            halign={Gtk.Align.START}
                                        />
                                    </GtkBox>
                                    <GtkBox
                                        orientation={Gtk.Orientation.VERTICAL}
                                        valign={Gtk.Align.CENTER}
                                        halign={Gtk.Align.END}
                                        widthRequest={200}
                                    >
                                        {renderPreview(styleClass)}
                                    </GtkBox>
                                </GtkBox>
                            </GtkListBoxRow>
                        ))}
                    </GtkListBox>
                </GtkScrolledWindow>
            </GtkFrame>

            <GtkFrame label="Typography Scale">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkLabel label="Title 1 - Main Heading" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                    <GtkLabel label="Title 2 - Section Heading" cssClasses={["title-2"]} halign={Gtk.Align.START} />
                    <GtkLabel label="Title 3 - Subsection" cssClasses={["title-3"]} halign={Gtk.Align.START} />
                    <GtkLabel label="Title 4 - Small Title" cssClasses={["title-4"]} halign={Gtk.Align.START} />
                    <GtkLabel label="Heading - Bold emphasis" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel label="Body - Regular paragraph text" cssClasses={["body"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label="Caption - Small descriptive text"
                        cssClasses={["caption"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="Dim Label - Secondary information"
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="const code = 'Monospace text';"
                        cssClasses={["monospace"]}
                        halign={Gtk.Align.START}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Button Styles">
                <GtkBox
                    spacing={12}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkButton label="Default" onClicked={() => {}} />
                    <GtkButton label="Suggested" cssClasses={["suggested-action"]} onClicked={() => {}} />
                    <GtkButton label="Destructive" cssClasses={["destructive-action"]} onClicked={() => {}} />
                    <GtkButton label="Flat" cssClasses={["flat"]} onClicked={() => {}} />
                    <GtkButton label="Raised" cssClasses={["raised"]} onClicked={() => {}} />
                    <GtkButton iconName="starred-symbolic" cssClasses={["circular"]} onClicked={() => {}} />
                    <GtkButton label="Pill" cssClasses={["pill"]} onClicked={() => {}} />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Linked Buttons">
                <GtkBox
                    spacing={24}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox cssClasses={["linked"]}>
                        <GtkButton label="Left" onClicked={() => {}} />
                        <GtkButton label="Center" onClicked={() => {}} />
                        <GtkButton label="Right" onClicked={() => {}} />
                    </GtkBox>

                    <GtkBox cssClasses={["linked"]} orientation={Gtk.Orientation.VERTICAL}>
                        <GtkButton label="Top" onClicked={() => {}} />
                        <GtkButton label="Middle" onClicked={() => {}} />
                        <GtkButton label="Bottom" onClicked={() => {}} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <GtkLabel label="Usage" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label={
                        'Apply classes with cssClasses prop: <GtkButton cssClasses={["suggested-action", "pill"]} />. Multiple classes can be combined. Classes automatically adapt to theme changes.'
                    }
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </GtkBox>
        </GtkBox>
    );
};

export const styleClassesDemo: Demo = {
    id: "style-classes",
    title: "Theming/Style Classes",
    description: "Built-in Adwaita styling classes for widgets",
    keywords: ["css", "classes", "adwaita", "typography", "buttons", "style"],
    component: StyleClassesDemo,
    sourceCode,
};
