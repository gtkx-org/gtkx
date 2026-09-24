import * as Gdk from "@gtkx/gi/gdk";
import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { GListStore } from "@gtkx/jsx/gio";
import {
    GtkButton,
    GtkCallbackAction,
    GtkFileDialog,
    GtkFileFilter,
    GtkHeaderBar,
    GtkImage,
    GtkShortcut,
    GtkShortcutController,
    GtkShortcutTrigger,
    GtkVideo,
} from "@gtkx/jsx/gtk";
import { createPortal, rootElement, useSignal } from "@gtkx/react";
import { createContext, useContext, useEffect, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import gtkLogoCursorPath from "../../../data/demos/gtk_logo_cursor.png?resource";
import bbbPngPath from "../../../data/demos/media/bbb.png?resource";
import gtkLogoPath from "../../../data/demos/media/gtk-logo.webm?resource";
import { isCancellation } from "../../is-cancellation.js";
import { useCancellable } from "../../use-cancellable.js";
import sourceCode from "./video-player.tsx?raw";

type VideoPlayerContextValue = {
    videoFile: Gio.File | null;
    isFullscreen: boolean;
    logoPaintable: Gdk.Texture;
    bbbPaintable: Gdk.Texture;
    handleOpen: () => void;
    handleLogo: () => void;
    handleBBB: () => void;
    handleToggleFullscreen: () => void;
};

const VideoPlayerContext = createContext<VideoPlayerContextValue | null>(null);

const videoPlayerDemo: Demo = {
    id: "video-player",
    title: "Video Player",
    description: "A small GTKX video player with file selection, sample media and fullscreen controls.",
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

const openVideoDialog = async (
    dialog: Gtk.FileDialog,
    window: Gtk.Window | null,
    cancellable: Gio.Cancellable,
    setVideoFile: (f: Gio.File) => void,
) => {
    try {
        const file = await dialog.open(window, cancellable);
        setVideoFile(file);
    } catch (error) {
        if (!isCancellation(error) && error instanceof Error) {
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

function useVideoFileDialog() {
    const [dialog, setDialog] = useState<Gtk.FileDialog | null>(null);
    const [filters, setFilters] = useState<Gio.ListStore | null>(null);
    const [allFilter, setAllFilter] = useState<Gtk.FileFilter | null>(null);
    const [imageFilter, setImageFilter] = useState<Gtk.FileFilter | null>(null);
    const [videoFilter, setVideoFilter] = useState<Gtk.FileFilter | null>(null);
    const cancellable = useCancellable();

    useEffect(() => {
        if (filters !== null && allFilter !== null && imageFilter !== null && videoFilter !== null) {
            filters.splice(0, filters.getNItems(), [allFilter, imageFilter, videoFilter]);
        }
    }, [allFilter, filters, imageFilter, videoFilter]);

    const portal = createPortal(
        <>
            <GtkFileFilter ref={setAllFilter} name="All Files" patterns={["*"]} />
            <GtkFileFilter ref={setImageFilter} name="Images" mimeTypes={["image/*"]} />
            <GtkFileFilter ref={setVideoFilter} name="Video" mimeTypes={["video/*"]} />
            <GListStore ref={setFilters} itemType={Gtk.FileFilter.prototype.__type__} />
            <GtkFileDialog ref={setDialog} title="Select a video" filters={filters} defaultFilter={videoFilter} />
            {cancellable.element}
        </>,
        rootElement,
    );

    return { dialog, cancellable, portal };
}

function VideoPlayerProvider({ window, children }: DemoProviderProps) {
    const [videoFile, setVideoFile] = useState<Gio.File | null>(null);
    const [isFullscreen, setIsFullscreen] = useState(false);
    const [logoPaintable] = useState(() => Gdk.Texture.newFromResource(gtkLogoCursorPath));
    const [bbbPaintable] = useState(() => Gdk.Texture.newFromResource(bbbPngPath));
    const { dialog, cancellable, portal } = useVideoFileDialog();

    useSignal(window, "notify::fullscreened", () => {
        setIsFullscreen(window?.isFullscreen() ?? false);
    }, {
        isImmediate: true,
    });

    const handleOpen = () => {
        if (dialog !== null && cancellable.cancellable !== null) {
            void openVideoDialog(dialog, window, cancellable.cancellable, setVideoFile).finally(cancellable.renew);
        }
    };

    const handleLogo = () => {
        setVideoFile(Gio.File.newForUri(`resource://${gtkLogoPath}`));
    };

    const handleBBB = () => {
        setVideoFile(Gio.File.newForUri("https://download.blender.org/peach/trailer/trailer_400p.ogg"));
    };

    const handleToggleFullscreen = () => {
        toggleFullscreen(window);
    };

    const value = {
        videoFile,
        isFullscreen,
        logoPaintable,
        bbbPaintable,
        handleOpen,
        handleLogo,
        handleBBB,
        handleToggleFullscreen,
    };

    return (
        <>
            {portal}
            <VideoPlayerContext.Provider value={value}>{children}</VideoPlayerContext.Provider>
        </>
    );
}

function VideoPlayerTitlebar() {
    const { isFullscreen, logoPaintable, bbbPaintable, handleOpen, handleLogo, handleBBB, handleToggleFullscreen } =
        useVideoPlayerContext();
    const fullscreenLabel = isFullscreen ? "Exit fullscreen" : "Fullscreen";

    return (
        <GtkHeaderBar
            start={(
                <>
                    <GtkButton name="open-button" label="_Open" useUnderline onClicked={handleOpen} />
                    <GtkButton
                        name="logo-button"
                        accessibleLabel="GTK Logo"
                        tooltipText="GTK Logo"
                        onClicked={handleLogo}
                    >
                        <GtkImage
                            paintable={logoPaintable}
                            pixelSize={24}
                            accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                        />
                    </GtkButton>
                    <GtkButton
                        name="bbb-button"
                        accessibleLabel="Big Buck Bunny"
                        tooltipText="Big Buck Bunny"
                        onClicked={handleBBB}
                    >
                        <GtkImage
                            name="bbb-image"
                            paintable={bbbPaintable}
                            pixelSize={24}
                            accessibleRole={Gtk.AccessibleRole.PRESENTATION}
                        />
                    </GtkButton>
                </>
            )}
            end={(
                <GtkButton
                    name="fullscreen-button"
                    iconName={isFullscreen ? "view-restore-symbolic" : "view-fullscreen-symbolic"}
                    accessibleLabel={fullscreenLabel}
                    tooltipText={fullscreenLabel}
                    onClicked={handleToggleFullscreen}
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
            accessibleRole={Gtk.AccessibleRole.GROUP}
            accessibleLabel="Video player"
            file={videoFile}
            autoplay
            graphicsOffload={Gtk.GraphicsOffloadEnabled.ENABLED}
            controllers={(
                <GtkShortcutController
                    scope={Gtk.ShortcutScope.GLOBAL}
                    shortcuts={(
                        <GtkShortcut
                            trigger={<GtkShortcutTrigger accelerator="F11" />}
                            action={(
                                <GtkCallbackAction
                                    callback={() => {
                                        handleToggleFullscreen();

                                        return true;
                                    }}
                                />
                            )}
                        />
                    )}
                />
            )}
        />
    );
}

export { videoPlayerDemo };
