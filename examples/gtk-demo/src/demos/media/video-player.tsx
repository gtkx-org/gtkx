import * as Gio from "@gtkx/ffi/gio";
import * as GObject from "@gtkx/ffi/gobject";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkCheckButton, GtkFrame, GtkImage, GtkLabel, GtkVideo, useApplication } from "@gtkx/react";
import { useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./video-player.tsx?raw";

const SAMPLE_VIDEOS = [
    {
        label: "Big Buck Bunny",
        url: "https://download.blender.org/peach/bigbuckbunny_movies/BigBuckBunny_320x180.mp4",
    },
    {
        label: "Sintel Trailer",
        url: "https://download.blender.org/durian/trailer/sintel_trailer-480p.mp4",
    },
];

const VideoPlayerDemo = () => {
    const app = useApplication();
    const [videoFile, setVideoFile] = useState<Gio.File | null>(null);
    const [videoPath, setVideoPath] = useState<string | null>(null);
    const [autoplay, setAutoplay] = useState(true);
    const [loop, setLoop] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleOpenFile = async () => {
        try {
            setError(null);
            const fileDialog = new Gtk.FileDialog();
            fileDialog.setTitle("Open Video File");
            fileDialog.setModal(true);

            const videoFilter = new Gtk.FileFilter();
            videoFilter.setName("Video Files");
            videoFilter.addMimeType("video/mp4");
            videoFilter.addMimeType("video/webm");
            videoFilter.addMimeType("video/x-matroska");
            videoFilter.addMimeType("video/ogg");
            videoFilter.addMimeType("video/avi");
            videoFilter.addMimeType("video/quicktime");
            videoFilter.addPattern("*.mp4");
            videoFilter.addPattern("*.webm");
            videoFilter.addPattern("*.mkv");
            videoFilter.addPattern("*.ogv");
            videoFilter.addPattern("*.avi");
            videoFilter.addPattern("*.mov");

            const allFilter = new Gtk.FileFilter();
            allFilter.setName("All Files");
            allFilter.addPattern("*");

            const filters = new Gio.ListStore(GObject.typeFromName("GtkFileFilter"));
            filters.append(videoFilter);
            filters.append(allFilter);
            fileDialog.setFilters(filters);
            fileDialog.setDefaultFilter(videoFilter);

            const file = await fileDialog.openAsync(app.getActiveWindow() ?? undefined);
            setVideoFile(file);
            setVideoPath(file.getPath() ?? file.getUri());
        } catch {
            /* User cancelled */
        }
    };

    const handleLoadSample = (url: string, label: string) => {
        setError(null);
        const file = Gio.fileNewForUri(url);
        setVideoFile(file);
        setVideoPath(label);
    };

    const handleClear = () => {
        setVideoFile(null);
        setVideoPath(null);
        setError(null);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Video Player" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkVideo is a widget for playing video files with built-in controls for playback, volume, and seeking. Select a video file or load a sample to begin playback."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Video Player">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} halign={Gtk.Align.CENTER} cssClasses={["card"]}>
                        {videoFile ? (
                            <GtkVideo
                                file={videoFile}
                                autoplay={autoplay}
                                loop={loop}
                                widthRequest={480}
                                heightRequest={270}
                            />
                        ) : (
                            <GtkBox
                                orientation={Gtk.Orientation.VERTICAL}
                                spacing={12}
                                widthRequest={480}
                                heightRequest={270}
                                valign={Gtk.Align.CENTER}
                                halign={Gtk.Align.CENTER}
                            >
                                <GtkImage
                                    iconName="video-x-generic-symbolic"
                                    pixelSize={64}
                                    cssClasses={["dim-label"]}
                                />
                                <GtkLabel label="No video loaded" cssClasses={["dim-label"]} />
                                <GtkLabel
                                    label="Open a file or select a sample video below"
                                    cssClasses={["dim-label", "caption"]}
                                />
                            </GtkBox>
                        )}
                    </GtkBox>

                    {videoPath && (
                        <GtkLabel
                            label={`Now playing: ${videoPath}`}
                            halign={Gtk.Align.CENTER}
                            cssClasses={["dim-label"]}
                            ellipsize={3}
                        />
                    )}

                    {error && <GtkLabel label={error} halign={Gtk.Align.CENTER} cssClasses={["error"]} wrap />}
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={16}
                    marginBottom={16}
                    marginStart={16}
                    marginEnd={16}
                >
                    <GtkBox spacing={12}>
                        <GtkButton onClicked={() => void handleOpenFile()}>
                            <GtkBox spacing={8}>
                                <GtkImage iconName="document-open-symbolic" />
                                <GtkLabel label="Open Video File..." />
                            </GtkBox>
                        </GtkButton>
                        {videoFile && (
                            <GtkButton onClicked={handleClear}>
                                <GtkBox spacing={8}>
                                    <GtkImage iconName="edit-clear-symbolic" />
                                    <GtkLabel label="Clear" />
                                </GtkBox>
                            </GtkButton>
                        )}
                    </GtkBox>

                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={8}>
                        <GtkLabel label="Sample Videos" halign={Gtk.Align.START} cssClasses={["heading"]} />
                        <GtkBox spacing={8}>
                            {SAMPLE_VIDEOS.map((sample) => (
                                <GtkButton
                                    key={sample.url}
                                    label={sample.label}
                                    onClicked={() => handleLoadSample(sample.url, sample.label)}
                                />
                            ))}
                        </GtkBox>
                        <GtkLabel
                            label="Sample videos are provided by the Blender Foundation (Creative Commons)"
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label", "caption"]}
                        />
                    </GtkBox>

                    <GtkBox spacing={24}>
                        <GtkCheckButton
                            label="Autoplay"
                            active={autoplay}
                            onToggled={(button) => setAutoplay(button.getActive())}
                        />
                        <GtkCheckButton
                            label="Loop"
                            active={loop}
                            onToggled={(button) => setLoop(button.getActive())}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Requirements">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkImage iconName="emblem-important-symbolic" pixelSize={24} />
                        <GtkLabel
                            label="GtkVideo requires GStreamer to be installed on the system. Supported formats depend on the available GStreamer plugins (gst-plugins-base, gst-plugins-good, gst-plugins-ugly, gst-plugins-bad)."
                            wrap
                            halign={Gtk.Align.START}
                            cssClasses={["dim-label"]}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const videoPlayerDemo: Demo = {
    id: "video-player",
    title: "Video Player",
    description: "Video playback with GtkVideo and media controls",
    keywords: ["video", "player", "media", "GtkVideo", "GtkMediaControls", "playback", "movie", "stream"],
    component: VideoPlayerDemo,
    sourceCode,
};
