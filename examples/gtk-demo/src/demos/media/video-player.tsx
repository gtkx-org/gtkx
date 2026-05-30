import * as Gdk from "@gtkx/ffi/gdk";
import * as Gio from "@gtkx/ffi/gio";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkButton, GtkHeaderBar, GtkImage, GtkShortcutController, GtkVideo } from "@gtkx/react";
import { createContext, useCallback, useContext, useMemo, useState } from "react";
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
    const logoPaintable = useMemo(() => Gdk.Texture.newFromResource(gtkLogoCursorPath), []);
    const bbbPaintable = useMemo(() => Gdk.Texture.newFromResource(bbbPngPath), []);

    const handleOpen = useCallback(() => {
        void openVideoDialog(window.current, setVideoFile);
    }, [window]);
    const handleLogo = useCallback(() => setVideoFile(Gio.fileNewForUri(gtkLogoUri)), []);
    const handleBBB = useCallback(
        () => setVideoFile(Gio.fileNewForUri("https://download.blender.org/peach/trailer/trailer_400p.ogg")),
        [],
    );
    const handleFullscreen = useCallback(() => window.current?.fullscreen(), [window]);
    const handleToggleFullscreen = useCallback(() => {
        const win = window.current;
        if (!win) return;
        if (win.isFullscreen()) win.unfullscreen();
        else win.fullscreen();
    }, [window]);

    const value = useMemo<VideoPlayerContextValue>(
        () => ({
            videoFile,
            logoPaintable,
            bbbPaintable,
            handleOpen,
            handleLogo,
            handleBBB,
            handleFullscreen,
            handleToggleFullscreen,
        }),
        [
            videoFile,
            logoPaintable,
            bbbPaintable,
            handleOpen,
            handleLogo,
            handleBBB,
            handleFullscreen,
            handleToggleFullscreen,
        ],
    );

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
                <GtkShortcutController.Shortcut trigger="F11" onActivate={handleToggleFullscreen} />
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
