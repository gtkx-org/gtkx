import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkImage, GtkLabel } from "@gtkx/react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const ImageDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Image" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="About <GtkImage Widget" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="GtkImage displays images from icon names, files, or resources. It's commonly used for icons in buttons, menus, and toolbars."
                    wrap
                    cssClasses={["dim-label"]}
                />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="From Icon Names" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkLabel
                    label="Icons can be loaded from the system icon theme using symbolic or regular variants."
                    wrap
                    cssClasses={["dim-label"]}
                />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="document-open-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="document-open" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="document-save-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="document-save" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="edit-copy-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="edit-copy" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="edit-delete-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="edit-delete" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Common Action Icons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="list-add-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="list-add" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="list-remove-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="list-remove" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="go-previous-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="go-previous" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="go-next-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="go-next" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Status Icons" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={24} halign={Gtk.Align.CENTER}>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="dialog-information-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="info" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="dialog-warning-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="warning" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="dialog-error-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="error" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="emblem-ok-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="ok" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkBox>
        </GtkBox>
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
