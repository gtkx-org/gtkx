import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkPicture, GtkVideo } from "@gtkx/react";
import { useCallback, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./paintable-mediastream.tsx?raw";

const PaintableMediastreamDemo = () => {
    const [isPlaying, setIsPlaying] = useState(false);
    const [isMuted, setIsMuted] = useState(false);
    const videoRef = useRef<Gtk.Video | null>(null);

    const mediaFile = useMemo(() => {
        return new Gtk.MediaFile();
    }, []);

    const handlePlayPause = useCallback(() => {
        if (isPlaying) {
            mediaFile.pause?.();
        } else {
            mediaFile.play?.();
        }
        setIsPlaying(!isPlaying);
    }, [mediaFile, isPlaying]);

    const handleMuteToggle = useCallback(() => {
        setIsMuted(!isMuted);
        mediaFile.setMuted?.(!isMuted);
    }, [mediaFile, isMuted]);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="MediaStream Paintable" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkMediaStream is a paintable that represents media playback. It provides video frames as paintable content and includes audio playback. GtkMediaFile is a concrete implementation that plays files from disk or network."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Video Player (GtkVideo)">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkVideo displays a GtkMediaStream with playback controls:"
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />

                    <GtkVideo
                        ref={videoRef}
                        autoplay={false}
                        loop
                        widthRequest={400}
                        heightRequest={300}
                        halign={Gtk.Align.CENTER}
                        cssClasses={["card"]}
                    />

                    <GtkLabel
                        label="Note: Load a video file to see playback. GtkVideo includes built-in controls."
                        cssClasses={["dim-label", "caption"]}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="MediaStream as Paintable">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkMediaStream implements GdkPaintable, so it can be used with GtkPicture for custom video display without controls:"
                        cssClasses={["dim-label"]}
                        wrap
                        halign={Gtk.Align.START}
                    />

                    <GtkBox spacing={16} halign={Gtk.Align.CENTER}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkPicture
                                paintable={mediaFile}
                                contentFit={Gtk.ContentFit.CONTAIN}
                                widthRequest={200}
                                heightRequest={150}
                                cssClasses={["card"]}
                            />
                            <GtkLabel label="GtkPicture" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                    </GtkBox>

                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        <GtkButton
                            label={isPlaying ? "Pause" : "Play"}
                            onClicked={handlePlayPause}
                            cssClasses={["suggested-action"]}
                        />
                        <GtkButton label={isMuted ? "Unmute" : "Mute"} onClicked={handleMuteToggle} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="MediaStream API">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel label="GtkMediaStream Properties:" cssClasses={["heading"]} halign={Gtk.Align.START} />
                    <GtkLabel
                        label={`playing - Whether media is currently playing
ended - Whether playback has finished
duration - Total length in microseconds
timestamp - Current position in microseconds
volume - Audio volume (0.0 to 1.0)
muted - Whether audio is muted
loop - Whether to loop playback
seekable - Whether seeking is supported
seeking - Whether currently seeking
hasAudio - Whether stream has audio
hasVideo - Whether stream has video
prepared - Whether stream is ready to play`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="MediaStream Methods">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`play() - Start or resume playback
pause() - Pause playback
seek(timestamp) - Seek to position
realize(surface) - Prepare for playback
unrealize(surface) - Release resources

GtkMediaFile methods:
setFilename(path) - Load file by path
setFile(gio_file) - Load from GIO file
setInputStream(stream) - Load from stream
setResource(path) - Load from GResource`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Video Formats">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkMediaFile uses GStreamer for media decoding. Supported formats depend on installed GStreamer plugins:"
                        wrap
                        cssClasses={["dim-label"]}
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label={`Common formats:
- MP4 (H.264/H.265 + AAC)
- WebM (VP8/VP9 + Vorbis/Opus)
- MKV (various codecs)
- OGG (Theora + Vorbis)
- AVI, MOV, and more

Install gstreamer plugins for codec support:
 gst-plugins-base - Basic formats
 gst-plugins-good - Common formats
 gst-plugins-bad - Newer formats
 gst-plugins-ugly - Patented codecs`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Use Cases">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label={`GtkMediaStream paintable use cases:

1. Video playback in custom widgets
2. Video thumbnails in file browsers
3. Background video effects
4. Camera preview widgets
5. Screen recording preview
6. Animated splash screens
7. Video messaging applications

For simple video playback, use GtkVideo.
For custom display or multiple views, use GtkPicture with MediaStream.`}
                        halign={Gtk.Align.START}
                        cssClasses={["monospace"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const paintableMediastreamDemo: Demo = {
    id: "paintable-mediastream",
    title: "Paintable/Media Stream",
    description: "Video playback with GtkMediaStream as paintable",
    keywords: [
        "paintable",
        "mediastream",
        "video",
        "GtkMediaStream",
        "GtkMediaFile",
        "GtkVideo",
        "playback",
        "gstreamer",
    ],
    component: PaintableMediastreamDemo,
    sourceCode,
};
