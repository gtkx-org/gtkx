import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Image, Label } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

export const ImageDemo = () => {
    return (
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label.Root label="Image" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="About Image Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="GtkImage displays images from icon names, files, or resources. It's commonly used for icons in buttons, menus, and toolbars."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="From Icon Names" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Label.Root
                    label="Icons can be loaded from the system icon theme using symbolic or regular variants."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="document-open-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="document-open" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="document-save-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="document-save" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="edit-copy-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="edit-copy" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="edit-delete-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="edit-delete" cssClasses={["dim-label", "caption"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Common Action Icons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="list-add-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="list-add" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="list-remove-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="list-remove" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="go-previous-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="go-previous" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="go-next-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="go-next" cssClasses={["dim-label", "caption"]} />
                    </Box>
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label.Root label="Status Icons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="dialog-information-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="info" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="dialog-warning-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="warning" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="dialog-error-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="error" cssClasses={["dim-label", "caption"]} />
                    </Box>
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <Image iconName="emblem-ok-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <Label.Root label="ok" cssClasses={["dim-label", "caption"]} />
                    </Box>
                </Box>
            </Box>
        </Box>
    );
};

export const imageDemo: Demo = {
    id: "image",
    title: "Image",
    description: "Display images from icons, files, or resources.",
    keywords: ["image", "icon", "picture", "graphics", "GtkImage"],
    component: ImageDemo,
    sourcePath: getSourcePath(import.meta.url, "image.tsx"),
};
