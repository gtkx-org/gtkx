import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkImage, GtkLabel } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paintable-symbolic.tsx?raw";

const ICON_CATEGORIES = {
    Actions: [
        "document-new-symbolic",
        "document-open-symbolic",
        "document-save-symbolic",
        "edit-copy-symbolic",
        "edit-paste-symbolic",
        "edit-delete-symbolic",
        "edit-undo-symbolic",
        "edit-redo-symbolic",
    ],
    Navigation: [
        "go-home-symbolic",
        "go-previous-symbolic",
        "go-next-symbolic",
        "go-up-symbolic",
        "go-down-symbolic",
        "view-refresh-symbolic",
    ],
    Status: [
        "dialog-information-symbolic",
        "dialog-warning-symbolic",
        "dialog-error-symbolic",
        "dialog-question-symbolic",
        "emblem-ok-symbolic",
        "process-stop-symbolic",
    ],
    Media: [
        "media-playback-start-symbolic",
        "media-playback-pause-symbolic",
        "media-playback-stop-symbolic",
        "media-skip-backward-symbolic",
        "media-skip-forward-symbolic",
        "audio-volume-high-symbolic",
    ],
    System: [
        "preferences-system-symbolic",
        "system-search-symbolic",
        "user-home-symbolic",
        "user-trash-symbolic",
        "folder-symbolic",
        "computer-symbolic",
    ],
};

const ICON_SIZES = [16, 24, 32, 48, 64, 96];

const PaintableSymbolicDemo = () => {
    const [selectedCategory, setSelectedCategory] = useState<keyof typeof ICON_CATEGORIES>("Actions");
    const [selectedIcon, setSelectedIcon] = useState("document-new-symbolic");

    const icons = ICON_CATEGORIES[selectedCategory];

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Symbolic Icons" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Symbolic icons are monochrome icons that adapt to the current color scheme. They use GtkIconPaintable which implements GdkPaintable and GtkSymbolicPaintable interfaces. The icon color automatically matches the text color of the containing widget."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Icon Categories">
                <GtkBox
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {(Object.keys(ICON_CATEGORIES) as (keyof typeof ICON_CATEGORIES)[]).map((category) => (
                        <GtkButton
                            key={category}
                            label={category}
                            onClicked={() => {
                                setSelectedCategory(category);
                                const icons = ICON_CATEGORIES[category];
                                if (icons?.[0]) setSelectedIcon(icons[0]);
                            }}
                            cssClasses={selectedCategory === category ? ["suggested-action"] : []}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Icon Selection">
                <GtkBox
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {icons.map((iconName) => (
                        <GtkButton
                            key={iconName}
                            onClicked={() => setSelectedIcon(iconName)}
                            cssClasses={selectedIcon === iconName ? ["suggested-action"] : ["flat"]}
                        >
                            <GtkImage iconName={iconName} pixelSize={24} />
                        </GtkButton>
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Icon at Different Sizes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label={selectedIcon} cssClasses={["monospace"]} halign={Gtk.Align.CENTER} />

                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        {ICON_SIZES.map((size) => (
                            <GtkBox
                                key={size}
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={6}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkBox
                                    orientation={Gtk.Orientation.VERTICAL}
                                    widthRequest={size + 16}
                                    heightRequest={size + 16}
                                    halign={Gtk.Align.CENTER}
                                    valign={Gtk.Align.CENTER}
                                >
                                    <GtkImage iconName={selectedIcon} pixelSize={size} />
                                </GtkBox>
                                <GtkLabel label={`${size}px`} cssClasses={["dim-label", "caption"]} />
                            </GtkBox>
                        ))}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Icon in Different Contexts">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="Symbolic icons adapt their color to match the context:"
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkBox spacing={16} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkButton cssClasses={["suggested-action"]}>
                                <GtkBox spacing={8}>
                                    <GtkImage iconName={selectedIcon} />
                                    <GtkLabel label="Suggested" />
                                </GtkBox>
                            </GtkButton>
                            <GtkLabel label="Suggested Action" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkButton cssClasses={["destructive-action"]}>
                                <GtkBox spacing={8}>
                                    <GtkImage iconName={selectedIcon} />
                                    <GtkLabel label="Destructive" />
                                </GtkBox>
                            </GtkButton>
                            <GtkLabel label="Destructive Action" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkButton cssClasses={["flat"]}>
                                <GtkBox spacing={8}>
                                    <GtkImage iconName={selectedIcon} />
                                    <GtkLabel label="Flat" />
                                </GtkBox>
                            </GtkButton>
                            <GtkLabel label="Flat Button" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkButton sensitive={false}>
                                <GtkBox spacing={8}>
                                    <GtkImage iconName={selectedIcon} />
                                    <GtkLabel label="Disabled" />
                                </GtkBox>
                            </GtkButton>
                            <GtkLabel label="Insensitive" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Symbolic Icon Features">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`GtkIconPaintable (symbolic icons):
- Monochrome design adapts to theme colors
- Vector-based, scales to any size
- Uses CSS color properties for coloring
- Implements both GdkPaintable and GtkSymbolicPaintable
- Loaded from icon theme (hicolor, Adwaita, etc.)

Icon naming convention:
- Use "-symbolic" suffix for symbolic variants
- Example: "folder-symbolic" vs "folder" (full color)`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const paintableSymbolicDemo: Demo = {
    id: "paintable-symbolic",
    title: "Paintable/Symbolic Paintable",
    description: "Symbolic icon paintables that adapt to theme colors",
    keywords: ["paintable", "symbolic", "icon", "GtkIconPaintable", "theme", "monochrome", "adaptive"],
    component: PaintableSymbolicDemo,
    sourceCode,
};
