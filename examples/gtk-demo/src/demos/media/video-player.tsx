import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkHeaderBar, GtkImage, GtkShortcutController, GtkVideo, x } from "@gtkx/react";
import { useMemo, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import bbbPngPath from "./bbb.png";
import gtkLogoCursorPath from "./gtk_logo_cursor.png";
import gtkLogoPath from "./gtk-logo.webm";
import sourceCode from "./video-player.tsx?raw";

const VideoPlayerDemo = ({ window }: DemoProps) => {
    const [videoFile, setVideoFile] = useState<Gio.File | null>(null);
    const logoPaintable = useMemo(() => Gdk.Texture.newFromFilename(gtkLogoCursorPath), []);
    const bbbPaintable = useMemo(() => Gdk.Texture.newFromFilename(bbbPngPath), []);

    const handleOpen = async () => {
        const dialog = new Gtk.FileDialog();
        dialog.setTitle("Select a video");

        const filters = new Gio.ListStore(GObject.typeFromName("GtkFileFilter"));

        const allFilter = new Gtk.FileFilter();
        allFilter.setName("All Files");
        allFilter.addPattern("*");
        filters.append(allFilter);

        const imageFilter = new Gtk.FileFilter();
        imageFilter.setName("Images");
        imageFilter.addMimeType("image/*");
        filters.append(imageFilter);

        const videoFilter = new Gtk.FileFilter();
        videoFilter.setName("Video");
        videoFilter.addMimeType("video/*");
        filters.append(videoFilter);

        dialog.setFilters(filters);
        dialog.setDefaultFilter(videoFilter);

        try {
            const file = await dialog.openAsync(window.current);
            setVideoFile(file);
        } catch {
            /* User cancelled */
        }
    };

    const handleLogo = () => {
        const file = Gio.fileNewForPath(gtkLogoPath);
        setVideoFile(file);
    };

    const handleBBB = () => {
        const file = Gio.fileNewForUri("https://download.blender.org/peach/trailer/trailer_400p.ogg");
        setVideoFile(file);
    };

    const handleFullscreen = () => {
        const win = window.current;
        if (!win) return;
        win.fullscreen();
    };

    const handleToggleFullscreen = () => {
        const win = window.current;
        if (!win) return;
        if (win.isFullscreen()) {
            win.unfullscreen();
        } else {
            win.fullscreen();
        }
    };

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkButton label="_Open" useUnderline onClicked={() => void handleOpen()} />
                        <GtkButton accessibleLabel="GTK Logo" onClicked={handleLogo}>
                            <GtkImage paintable={logoPaintable} pixelSize={24} />
                        </GtkButton>
                        <GtkButton accessibleLabel="Big Buck Bunny" onClicked={handleBBB}>
                            <GtkImage paintable={bbbPaintable} pixelSize={24} />
                        </GtkButton>
                    </x.ContainerSlot>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkButton
                            iconName="view-fullscreen-symbolic"
                            accessibleLabel="Fullscreen"
                            onClicked={handleFullscreen}
                        />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                <x.Shortcut trigger="F11" onActivate={handleToggleFullscreen} />
            </GtkShortcutController>
            <GtkVideo file={videoFile} autoplay graphicsOffload={Gtk.GraphicsOffloadEnabled.ENABLED} />
        </>
    );
};

export const videoPlayerDemo: Demo = {
    id: "video-player",
    title: "Video Player",
    description: "This is a simple video player using just GTK widgets.",
    keywords: ["video", "player", "media", "GtkVideo", "GtkMediaStream", "GtkMediaFile"],
    component: VideoPlayerDemo,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
