import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkFrame, GtkImage, GtkLabel, GtkOverlay } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paintable-emblem.tsx?raw";

const EMBLEMS = [
    { name: "emblem-ok-symbolic", label: "OK/Success" },
    { name: "emblem-important-symbolic", label: "Important" },
    { name: "emblem-favorite-symbolic", label: "Favorite" },
    { name: "emblem-shared-symbolic", label: "Shared" },
    { name: "emblem-synchronizing-symbolic", label: "Syncing" },
    { name: "emblem-system-symbolic", label: "System" },
];

const BASE_ICONS = [
    "folder-symbolic",
    "folder-documents-symbolic",
    "folder-download-symbolic",
    "folder-music-symbolic",
    "folder-pictures-symbolic",
    "folder-videos-symbolic",
];

type EmblemPosition = "top-start" | "top-end" | "bottom-start" | "bottom-end";

const POSITIONS: { value: EmblemPosition; label: string }[] = [
    { value: "bottom-end", label: "Bottom Right" },
    { value: "bottom-start", label: "Bottom Left" },
    { value: "top-end", label: "Top Right" },
    { value: "top-start", label: "Top Left" },
];

const EmblemedIcon = ({
    baseIcon,
    emblemIcon,
    position,
    size,
    showEmblem,
}: {
    baseIcon: string;
    emblemIcon: string;
    position: EmblemPosition;
    size: number;
    showEmblem: boolean;
}) => {
    const emblemSize = Math.max(12, Math.floor(size * 0.4));

    const positionProps: Record<string, Gtk.Align | number> = {
        halign: position.includes("end") ? Gtk.Align.END : Gtk.Align.START,
        valign: position.includes("bottom") ? Gtk.Align.END : Gtk.Align.START,
    };

    return (
        <GtkOverlay>
            <GtkImage iconName={baseIcon} pixelSize={size} />
            {showEmblem && (
                <GtkImage
                    iconName={emblemIcon}
                    pixelSize={emblemSize}
                    halign={positionProps.halign as Gtk.Align}
                    valign={positionProps.valign as Gtk.Align}
                    marginStart={position.includes("start") ? 0 : 2}
                    marginEnd={position.includes("end") ? 0 : 2}
                    marginTop={position.includes("top") ? 0 : 2}
                    marginBottom={position.includes("bottom") ? 0 : 2}
                />
            )}
        </GtkOverlay>
    );
};

const PaintableEmblemDemo = () => {
    const [selectedEmblem, setSelectedEmblem] = useState(EMBLEMS[0]?.name ?? "emblem-ok-symbolic");
    const [selectedPosition, setSelectedPosition] = useState<EmblemPosition>("bottom-end");
    const [showEmblem, setShowEmblem] = useState(true);
    const [iconSize, setIconSize] = useState(48);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Icon Emblems" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="Emblems are small overlay icons that add status or category information to base icons. They are commonly used in file managers to show sync status, favorites, or permissions. GTK uses GtkOverlay to position emblem icons over base icons."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Emblem Selection">
                <GtkBox
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {EMBLEMS.map((emblem) => (
                        <GtkBox
                            key={emblem.name}
                            orientation={Gtk.Orientation.VERTICAL}
                            spacing={4}
                            halign={Gtk.Align.CENTER}
                        >
                            <GtkButton
                                onClicked={() => setSelectedEmblem(emblem.name)}
                                cssClasses={selectedEmblem === emblem.name ? ["suggested-action"] : ["flat"]}
                            >
                                <GtkImage iconName={emblem.name} pixelSize={24} />
                            </GtkButton>
                            <GtkLabel label={emblem.label} cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Emblemed Folders">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkCheckButton
                            label="Show Emblem"
                            active={showEmblem}
                            onToggled={(self) => setShowEmblem(self.getActive())}
                        />
                    </GtkBox>

                    <GtkBox spacing={32} halign={Gtk.Align.CENTER}>
                        {BASE_ICONS.map((baseIcon) => (
                            <GtkBox
                                key={baseIcon}
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={6}
                                halign={Gtk.Align.CENTER}
                            >
                                <EmblemedIcon
                                    baseIcon={baseIcon}
                                    emblemIcon={selectedEmblem}
                                    position={selectedPosition}
                                    size={iconSize}
                                    showEmblem={showEmblem}
                                />
                                <GtkLabel
                                    label={baseIcon.replace("-symbolic", "").replace("folder-", "")}
                                    cssClasses={["dim-label", "caption"]}
                                />
                            </GtkBox>
                        ))}
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Emblem Position">
                <GtkBox
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {POSITIONS.map((pos) => (
                        <GtkButton
                            key={pos.value}
                            label={pos.label}
                            onClicked={() => setSelectedPosition(pos.value)}
                            cssClasses={selectedPosition === pos.value ? ["suggested-action"] : []}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Icon Size">
                <GtkBox
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    {[32, 48, 64, 96].map((size) => (
                        <GtkButton
                            key={size}
                            label={`${size}px`}
                            onClicked={() => setIconSize(size)}
                            cssClasses={iconSize === size ? ["suggested-action"] : []}
                        />
                    ))}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Common Use Cases">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <EmblemedIcon
                                baseIcon="folder-symbolic"
                                emblemIcon="emblem-synchronizing-symbolic"
                                position="bottom-end"
                                size={48}
                                showEmblem
                            />
                            <GtkLabel label="Syncing" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <EmblemedIcon
                                baseIcon="folder-symbolic"
                                emblemIcon="emblem-ok-symbolic"
                                position="bottom-end"
                                size={48}
                                showEmblem
                            />
                            <GtkLabel label="Synced" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <EmblemedIcon
                                baseIcon="folder-symbolic"
                                emblemIcon="emblem-shared-symbolic"
                                position="bottom-end"
                                size={48}
                                showEmblem
                            />
                            <GtkLabel label="Shared" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <EmblemedIcon
                                baseIcon="folder-symbolic"
                                emblemIcon="emblem-favorite-symbolic"
                                position="bottom-end"
                                size={48}
                                showEmblem
                            />
                            <GtkLabel label="Favorite" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>

                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <EmblemedIcon
                                baseIcon="folder-symbolic"
                                emblemIcon="emblem-important-symbolic"
                                position="bottom-end"
                                size={48}
                                showEmblem
                            />
                            <GtkLabel label="Important" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Implementation Notes">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`Implementing emblemed icons:

1. Use GtkOverlay to layer icons
2. Base icon as the main child
3. Emblem icon as overlay child with alignment
4. Emblem size should be ~40% of base icon
5. Use symbolic icons for consistent theming

Common emblem icons:
 emblem-ok-symbolic - Success/completed
 emblem-important-symbolic - Warning/attention
 emblem-favorite-symbolic - Starred/bookmarked
 emblem-shared-symbolic - Shared with others
 emblem-synchronizing-symbolic - Sync in progress`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const paintableEmblemDemo: Demo = {
    id: "paintable-emblem",
    title: "Icon Emblems",
    description: "Overlay badges on icons using GtkOverlay",
    keywords: ["paintable", "emblem", "overlay", "badge", "icon", "status", "GtkOverlay", "folder"],
    component: PaintableEmblemDemo,
    sourceCode,
};
