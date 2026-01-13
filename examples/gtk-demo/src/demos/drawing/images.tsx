import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkPicture } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./images.tsx?raw";

const ImagesDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Images" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GTK4 provides two main widgets for displaying images: GtkImage for icon-sized images and themed icons, and GtkPicture for displaying images at their natural size or scaled to fit."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Themed Icons (GtkImage)">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkImage displays icons from the icon theme"
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="dialog-information-symbolic" />
                            <GtkLabel label="Info" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="dialog-warning-symbolic" />
                            <GtkLabel label="Warning" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="dialog-error-symbolic" />
                            <GtkLabel label="Error" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="dialog-question-symbolic" />
                            <GtkLabel label="Question" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Icon Sizes">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="folder-symbolic" iconSize={Gtk.IconSize.NORMAL} />
                        <GtkLabel label="Normal" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="folder-symbolic" iconSize={Gtk.IconSize.LARGE} />
                        <GtkLabel label="Large" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="folder-symbolic" pixelSize={48} />
                        <GtkLabel label="48px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkImage iconName="folder-symbolic" pixelSize={64} />
                        <GtkLabel label="64px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Common Icons">
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
                            <GtkImage iconName="document-new-symbolic" pixelSize={32} />
                            <GtkLabel label="New" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="document-open-symbolic" pixelSize={32} />
                            <GtkLabel label="Open" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="document-save-symbolic" pixelSize={32} />
                            <GtkLabel label="Save" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="edit-copy-symbolic" pixelSize={32} />
                            <GtkLabel label="Copy" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="edit-paste-symbolic" pixelSize={32} />
                            <GtkLabel label="Paste" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="edit-delete-symbolic" pixelSize={32} />
                            <GtkLabel label="Delete" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="go-home-symbolic" pixelSize={32} />
                            <GtkLabel label="Home" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="system-search-symbolic" pixelSize={32} />
                            <GtkLabel label="Search" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="emblem-system-symbolic" pixelSize={32} />
                            <GtkLabel label="Settings" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="help-about-symbolic" pixelSize={32} />
                            <GtkLabel label="About" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="view-refresh-symbolic" pixelSize={32} />
                            <GtkLabel label="Refresh" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="user-trash-symbolic" pixelSize={32} />
                            <GtkLabel label="Trash" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="GtkPicture">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkPicture displays images at natural size or scaled. Use 'file' prop for file paths."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                canShrink
                                contentFit={Gtk.ContentFit.CONTAIN}
                                widthRequest={150}
                                heightRequest={100}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="Contain" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                canShrink
                                contentFit={Gtk.ContentFit.COVER}
                                widthRequest={150}
                                heightRequest={100}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="Cover" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                canShrink
                                contentFit={Gtk.ContentFit.FILL}
                                widthRequest={150}
                                heightRequest={100}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="Fill" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>
                    <GtkLabel
                        label="Note: No image loaded. Use the 'file' prop to load an image file."
                        halign={Gtk.Align.CENTER}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const imagesDemo: Demo = {
    id: "images",
    title: "Images",
    description: "Display icons and images with GtkImage and GtkPicture",
    keywords: ["image", "picture", "icon", "GtkImage", "GtkPicture", "photo", "graphic", "display"],
    component: ImagesDemo,
    sourceCode,
};
