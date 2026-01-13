import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkFrame, GtkImage, GtkLabel, GtkVideo } from "@gtkx/react";
import type { Demo } from "../types.js";
import sourceCode from "./video-player.tsx?raw";

const VideoPlayerDemo = () => {
    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Video Player" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkVideo is a widget for playing video files. It provides built-in controls for playback, volume, and seeking. The widget supports autoplay and loop functionality."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="GtkVideo Widget">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkVideo displays a video with playback controls. Set a file path to load a video."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={12}
                        halign={Gtk.Align.CENTER}
                        cssClasses={["card"]}
                        marginTop={12}
                        marginBottom={12}
                        marginStart={24}
                        marginEnd={24}
                    >
                        <GtkVideo widthRequest={400} heightRequest={225} autoplay={false} loop={false} />
                        <GtkLabel
                            label="No video loaded"
                            cssClasses={["dim-label"]}
                            halign={Gtk.Align.CENTER}
                            marginBottom={12}
                        />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Video Properties">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkImage iconName="media-playback-start-symbolic" pixelSize={24} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                            <GtkLabel label="autoplay" halign={Gtk.Align.START} cssClasses={["heading"]} />
                            <GtkLabel
                                label="When set to true, the video automatically starts playing when loaded"
                                wrap
                                halign={Gtk.Align.START}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkImage iconName="media-playlist-repeat-symbolic" pixelSize={24} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                            <GtkLabel label="loop" halign={Gtk.Align.START} cssClasses={["heading"]} />
                            <GtkLabel
                                label="When set to true, the video restarts from the beginning when it ends"
                                wrap
                                halign={Gtk.Align.START}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkImage iconName="folder-videos-symbolic" pixelSize={24} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                            <GtkLabel label="file" halign={Gtk.Align.START} cssClasses={["heading"]} />
                            <GtkLabel
                                label="The path to the video file to play (supports common formats like MP4, WebM, etc.)"
                                wrap
                                halign={Gtk.Align.START}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkImage iconName="applications-multimedia-symbolic" pixelSize={24} />
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={4} hexpand>
                            <GtkLabel label="mediaStream" halign={Gtk.Align.START} cssClasses={["heading"]} />
                            <GtkLabel
                                label="Advanced: Provide a GtkMediaStream for custom media handling"
                                wrap
                                halign={Gtk.Align.START}
                                cssClasses={["dim-label"]}
                            />
                        </GtkBox>
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Usage Example">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="To use GtkVideo in your application:"
                        halign={Gtk.Align.START}
                        cssClasses={["heading"]}
                    />
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        cssClasses={["card"]}
                        marginTop={8}
                        marginStart={12}
                        marginEnd={12}
                    >
                        <GtkLabel
                            label={
                                '<GtkVideo\n file="/path/to/video.mp4"\n autoplay\n loop\n widthRequest={640}\n heightRequest={360}\n/>'
                            }
                            halign={Gtk.Align.START}
                            cssClasses={["monospace"]}
                            marginTop={12}
                            marginBottom={12}
                            marginStart={12}
                            marginEnd={12}
                        />
                    </GtkBox>
                    <GtkLabel
                        label="Note: GtkVideo requires GStreamer to be installed on the system for video playback. Supported formats depend on the available GStreamer plugins."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                        marginTop={8}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="GtkMediaControls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="GtkMediaControls provides playback controls (play/pause, seek, volume) that can be used independently or with GtkVideo. When used with GtkVideo, controls are automatically included."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["dim-label"]}
                    />
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER} marginTop={8}>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="media-skip-backward-symbolic" pixelSize={32} />
                            <GtkLabel label="Previous" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="media-playback-start-symbolic" pixelSize={32} />
                            <GtkLabel label="Play" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="media-playback-pause-symbolic" pixelSize={32} />
                            <GtkLabel label="Pause" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                            <GtkImage iconName="media-skip-forward-symbolic" pixelSize={32} />
                            <GtkLabel label="Next" cssClasses={["dim-label", "caption"]} />
                        </GtkBox>
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
