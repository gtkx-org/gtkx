import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GtkButton, GtkHeaderBar, GtkImage, GtkShortcut, GtkShortcutController, GtkVideo } from "@gtkx/jsx/gtk";
import { useSignal } from "@gtkx/react";
import { createContext, useContext, useState } from "react";
import { path as bbbPngPath } from "#data/demos/media/bbb.png";
import gtkLogoUri from "#data/demos/media/gtk-logo.webm";
import { path as gtkLogoCursorPath } from "#data/demos/media/gtk_logo_cursor.png";
import type { Demo, DemoProviderProps } from "../types.js";
import sourceCode from "./video-player.tsx?raw";

type VideoPlayerContextValue = {
    videoFile: Gio.File | null;
    fullscreened: boolean;
    logoPaintable: Gdk.Texture;
    bbbPaintable: Gdk.Texture;
    handleOpen: () => void;
    handleLogo: () => void;
    handleBBB: () => void;
    handleFullscreen: () => void;
    handleToggleFullscreen: () => void;
};

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

const videoPlayerDemo: Demo = {
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

const toggleFullscreen = (win: Gtk.Window | null) => {
    if (!win) {
        return;
    }

    if (win.isFullscreen()) {
        win.unfullscreen();
    } else {
        win.fullscreen();
    }
};

const openVideoDialog = async (window: Gtk.Window | null, setVideoFile: (f: Gio.File) => void) => {
    const dialog = new Gtk.FileDialog();
    dialog.setTitle("Select a video");
    const filters = Gio.ListStore.new(Gtk.FileFilter.prototype.__type__);
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
    } catch (error) {
        if (error instanceof Error) {
            console.error(error.message);
        }
    }
};

const useVideoPlayerContext = (): VideoPlayerContextValue => {
    const ctx = useContext(VideoPlayerContext);

    if (!ctx) {
        throw new Error("VideoPlayerContext is missing");
    }

    return ctx;
};

function VideoPlayerProvider({ window, children }: DemoProviderProps) {
    const [videoFile, setVideoFile] = useState<Gio.File | null>(null);
    const [fullscreened, setFullscreened] = useState(false);
    const logoPaintable = Gdk.Texture.newFromResource(gtkLogoCursorPath);
    const bbbPaintable = Gdk.Texture.newFromResource(bbbPngPath);

    useSignal(window, "notify::fullscreened", () => {
        setFullscreened(window.current?.isFullscreen() ?? false);
    }, {
        immediate: true,
    });

    const handleOpen = () => {
        void openVideoDialog(window.current, setVideoFile);
    };

    const handleLogo = () => {
        setVideoFile(Gio.File.newForUri(gtkLogoUri));
    };

    const handleBBB = () => {
        setVideoFile(Gio.File.newForUri("https://download.blender.org/peach/trailer/trailer_400p.ogg"));
    };

    const handleFullscreen = () => window.current?.fullscreen();

    const handleToggleFullscreen = () => {
        toggleFullscreen(window.current);
    };

    const value = {
        videoFile,
        fullscreened,
        logoPaintable,
        bbbPaintable,
        handleOpen,
        handleLogo,
        handleBBB,
        handleFullscreen,
        handleToggleFullscreen,
    };

    return <VideoPlayerContext.Provider value={value}>{children}</VideoPlayerContext.Provider>;
}

function VideoPlayerTitlebar() {
    const { fullscreened, logoPaintable, bbbPaintable, handleOpen, handleLogo, handleBBB, handleFullscreen } =
        useVideoPlayerContext();

    return (
        <GtkHeaderBar
            start={(
                <>
                    <GtkButton name="open-button" label="_Open" useUnderline onClicked={handleOpen} />
                    <GtkButton name="logo-button" accessibleLabel="GTK Logo" onClicked={handleLogo}>
                        <GtkImage paintable={logoPaintable} pixelSize={24} />
                    </GtkButton>
                    <GtkButton name="bbb-button" accessibleLabel="Big Buck Bunny" onClicked={handleBBB}>
                        <GtkImage name="bbb-image" paintable={bbbPaintable} pixelSize={24} />
                    </GtkButton>
                </>
            )}
            end={(
                <GtkButton
                    name="fullscreen-button"
                    iconName={fullscreened ? "view-restore-symbolic" : "view-fullscreen-symbolic"}
                    accessibleLabel="Fullscreen"
                    onClicked={handleFullscreen}
                />
            )}
        />
    );
}

function VideoPlayerDemo() {
    const { videoFile, handleToggleFullscreen } = useVideoPlayerContext();

    return (
        <GtkVideo
            name="video"
            file={videoFile}
            autoplay
            graphicsOffload={Gtk.GraphicsOffloadEnabled.ENABLED}
            controllers={(
                <GtkShortcutController
                    scope={Gtk.ShortcutScope.GLOBAL}
                    shortcuts={(
                        <GtkShortcut
                            trigger={Gtk.ShortcutTrigger.parseString("F11")}
                            action={Gtk.CallbackAction.new(() => {
                                handleToggleFullscreen();

                                return true;
                            })}
                        />
                    )}
                />
            )}
        />
    );
}

export { videoPlayerDemo };
