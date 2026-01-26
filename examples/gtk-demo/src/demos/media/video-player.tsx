import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkHeaderBar, GtkVideo, useApplication, x } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./video-player.tsx?raw";

const VideoPlayerDemo = () => {
    const app = useApplication();
    const [videoFile, setVideoFile] = useState<Gio.File | null>(null);

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
            const file = await dialog.openAsync(app.getActiveWindow() ?? undefined);
            setVideoFile(file);
        } catch {
            /* User cancelled */
        }
    };

    const handleLogo = () => {
        const file = Gio.fileNewForPath(`${import.meta.dirname}/gtk-logo.webm`);
        setVideoFile(file);
    };

    const handleBBB = () => {
        const file = Gio.fileNewForUri("https://download.blender.org/peach/trailer/trailer_400p.ogg");
        setVideoFile(file);
    };

    const handleFullscreen = () => {
        const window = app.getActiveWindow();
        if (window) {
            window.fullscreen();
        }
    };

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.PackStart>
                        <GtkButton label="_Open" useUnderline onClicked={() => void handleOpen()} />
                        <GtkButton label="GTK Logo" onClicked={handleLogo} />
                        <GtkButton label="Big Buck Bunny" onClicked={handleBBB} />
                    </x.PackStart>
                    <x.PackEnd>
                        <GtkButton iconName="view-fullscreen-symbolic" onClicked={handleFullscreen} />
                    </x.PackEnd>
                </GtkHeaderBar>
            </x.Slot>
            <GtkVideo file={videoFile ?? undefined} autoplay />
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
};
