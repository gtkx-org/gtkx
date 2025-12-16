import { css } from "@gtkx/css";
import * as Gtk from "@gtkx/ffi/gtk";
import { Box, GridView, Label, ScrolledWindow } from "@gtkx/react";

interface Photo {
    id: string;
    title: string;
    color: string;
    size: string;
}

const photos: Photo[] = [
    { id: "1", title: "Sunset Beach", color: "#ff6b35", size: "2.4 MB" },
    { id: "2", title: "Mountain Peak", color: "#4ecdc4", size: "3.1 MB" },
    { id: "3", title: "City Lights", color: "#45b7d1", size: "1.8 MB" },
    { id: "4", title: "Forest Path", color: "#96ceb4", size: "2.9 MB" },
    { id: "5", title: "Ocean Waves", color: "#3498db", size: "2.2 MB" },
    { id: "6", title: "Desert Dunes", color: "#f39c12", size: "3.5 MB" },
    { id: "7", title: "Northern Lights", color: "#9b59b6", size: "4.1 MB" },
    { id: "8", title: "Autumn Leaves", color: "#e74c3c", size: "2.7 MB" },
    { id: "9", title: "Snow Peaks", color: "#ecf0f1", size: "3.3 MB" },
    { id: "10", title: "Rainforest", color: "#27ae60", size: "2.8 MB" },
    { id: "11", title: "Starry Night", color: "#2c3e50", size: "3.9 MB" },
    { id: "12", title: "Coral Reef", color: "#1abc9c", size: "2.5 MB" },
    { id: "13", title: "Lavender Field", color: "#8e44ad", size: "2.1 MB" },
    { id: "14", title: "Cherry Blossom", color: "#fd79a8", size: "1.9 MB" },
    { id: "15", title: "Golden Hour", color: "#fdcb6e", size: "3.0 MB" },
    { id: "16", title: "Misty Morning", color: "#b2bec3", size: "2.6 MB" },
];

const photoTile = (color: string) => css`
    background: ${color};
    border-radius: 8px;
`;

export const GridViewDemo = () => {
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
                <Label label="GridView" cssClasses={["title-1"]} halign={Gtk.Align.START} />
                <Label
                    label="GtkGridView displays items in a grid layout with virtual scrolling. Perfect for photo galleries, file browsers, and icon views where items should be arranged in rows and columns."
                    wrap
                    cssClasses={["dim-label"]}
                    halign={Gtk.Align.START}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12} vexpand>
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={8}>
                    <Label label="Photo Gallery" cssClasses={["heading"]} halign={Gtk.Align.START} hexpand />
                    <Label label={`${photos.length} photos`} cssClasses={["dim-label"]} />
                </Box>

                <ScrolledWindow vexpand>
                    <GridView.Root
                        minColumns={2}
                        maxColumns={6}
                        renderItem={(photo: Photo | null) => (
                            <Box
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={4}
                                marginStart={4}
                                marginEnd={4}
                                marginTop={4}
                                marginBottom={4}
                                widthRequest={140}
                            >
                                <Box
                                    orientation={Gtk.Orientation.VERTICAL}
                                    spacing={0}
                                    heightRequest={100}
                                    cssClasses={[photoTile(photo?.color ?? "#ccc")]}
                                    hexpand
                                />
                                <Label
                                    label={photo?.title ?? ""}
                                    halign={Gtk.Align.START}
                                    ellipsize={3}
                                    cssClasses={["caption"]}
                                />
                                <Label
                                    label={photo?.size ?? ""}
                                    halign={Gtk.Align.START}
                                    cssClasses={["dim-label", "caption"]}
                                />
                            </Box>
                        )}
                    >
                        {photos.map((photo) => (
                            <GridView.Item key={photo.id} item={photo} />
                        ))}
                    </GridView.Root>
                </ScrolledWindow>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                <Label label="Key Features" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label
                    label="• Automatic grid layout with configurable columns\n• Virtual scrolling for large datasets\n• minColumns and maxColumns for responsive design\n• Same renderItem pattern as ListView"
                    wrap
                    halign={Gtk.Align.START}
                    cssClasses={["dim-label"]}
                />
            </Box>
        </Box>
    );
};
