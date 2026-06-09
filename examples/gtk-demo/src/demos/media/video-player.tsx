import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkHeaderBar, GtkImage, GtkShortcut, GtkShortcutController, GtkVideo } from "@gtkx/react";
import { createContext, useContext, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { path as bbbPngPath } from "./bbb.png";
import { path as gtkLogoCursorPath } from "./gtk_logo_cursor.png";
import gtkLogoUri from "./gtk-logo.webm";
import sourceCode from "./video-player.tsx?raw";

const openVideoDialog = async (window: Gtk.Window | null, setVideoFile: (f: Gio.File) => void) => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Select a video");

    const filters = Gio.ListStore.new(Gtk.FileFilter.prototype.__gtype__);

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
        const file = await dialog.open(window, null);
        setVideoFile(file);
    } catch (e) {
        if (e instanceof Error) console.error(e.message);
    }
};

interface VideoPlayerContextValue {
    videoFile: Gio.File | null;
    logoPaintable: Gdk.Texture;
    bbbPaintable: Gdk.Texture;
    handleOpen: () => void;
    handleLogo: () => void;
    handleBBB: () => void;
    handleFullscreen: () => void;
    handleToggleFullscreen: () => void;
}

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

const useVideoPlayerContext = (): VideoPlayerContextValue => {
    const ctx = useContext(VideoPlayerContext);
    if (!ctx) throw new Error("VideoPlayerContext is missing");
    return ctx;
};

const VideoPlayerProvider = ({ window, children }: DemoProviderProps) => {
    const [videoFile, setVideoFile] = useState<Gio.File | null>(null);
    const logoPaintable = Gdk.Texture.newFromResource(gtkLogoCursorPath);
    const bbbPaintable = Gdk.Texture.newFromResource(bbbPngPath);

    const handleOpen = () => {
        void openVideoDialog(window.current, setVideoFile);
    };
    const handleLogo = () => setVideoFile(Gio.fileNewForUri(gtkLogoUri));
    const handleBBB = () =>
        setVideoFile(Gio.fileNewForUri("https://download.blender.org/peach/trailer/trailer_400p.ogg"));
    const handleFullscreen = () => window.current?.fullscreen();
    const handleToggleFullscreen = () => {
        const win = window.current;
        if (!win) return;
        if (win.isFullscreen()) win.unfullscreen();
        else win.fullscreen();
    };

    const value = {
        videoFile,
        logoPaintable,
        bbbPaintable,
        handleOpen,
        handleLogo,
        handleBBB,
        handleFullscreen,
        handleToggleFullscreen,
    };

    return <VideoPlayerContext.Provider value={value}>{children}</VideoPlayerContext.Provider>;
};

const VideoPlayerTitlebar = () => {
    const { logoPaintable, bbbPaintable, handleOpen, handleLogo, handleBBB, handleFullscreen } =
        useVideoPlayerContext();
    return (
        <GtkHeaderBar
            packStart={
                <>
                    <GtkButton name="open-button" label="_Open" useUnderline onClicked={handleOpen} />
                    <GtkButton name="logo-button" accessibleLabel="GTK Logo" onClicked={handleLogo}>
                        <GtkImage paintable={logoPaintable} pixelSize={24} />
                    </GtkButton>
                    <GtkButton name="bbb-button" accessibleLabel="Big Buck Bunny" onClicked={handleBBB}>
                        <GtkImage name="bbb-image" paintable={bbbPaintable} pixelSize={24} />
                    </GtkButton>
                </>
            }
            packEnd={
                <GtkButton
                    name="fullscreen-button"
                    iconName="view-fullscreen-symbolic"
                    accessibleLabel="Fullscreen"
                    onClicked={handleFullscreen}
                />
            }
        />
    );
};

const VideoPlayerDemo = () => {
    const { videoFile, handleToggleFullscreen } = useVideoPlayerContext();
    return (
        <>
            <GtkShortcutController scope={Gtk.ShortcutScope.GLOBAL}>
                <GtkShortcut
                    trigger={Gtk.ShortcutTrigger.parseString("F11")}
                    action={Gtk.CallbackAction.new(() => {
                        handleToggleFullscreen();
                        return true;
                    })}
                />
            </GtkShortcutController>
            <GtkVideo name="video" file={videoFile} autoplay graphicsOffload={Gtk.GraphicsOffloadEnabled.ENABLED} />
        </>
    );
};

export const videoPlayerDemo: Demo = {
    id: "video-player",
    title: "Video Player",
    description: "This is a simple video player using just GTK widgets.",
    keywords: ["GtkVideo", "GtkMediaStream", "GtkMediaFile", "GdkPaintable", "GtkMediaControls"],
    component: VideoPlayerDemo,
    titlebar: VideoPlayerTitlebar,
    provider: VideoPlayerProvider,
    sourceCode,
    defaultWidth: 600,
    defaultHeight: 400,
};
