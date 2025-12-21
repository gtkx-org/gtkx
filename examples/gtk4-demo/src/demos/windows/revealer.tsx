import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkLabel, GtkRevealer } from "@gtkx/react";
import { useState } from "react";
import { getSourcePath } from "../source-path.js";
import type { Demo } from "../types.js";

const RevealerDemo = () => {
    const [slideDown, setSlideDown] = useState(false);
    const [slideUp, setSlideUp] = useState(false);
    const [slideLeft, setSlideLeft] = useState(false);
    const [slideRight, setSlideRight] = useState(false);
    const [crossfade, setCrossfade] = useState(false);

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <GtkLabel label="Revealer" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Slide Down" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkButton label={slideDown ? "Hide" : "Show"} onClicked={() => setSlideDown((v) => !v)} />
                <GtkRevealer
                    revealChild={slideDown}
                    transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                    transitionDuration={300}
                >
                    <GtkBox
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        cssClasses={["card"]}
                        marginTop={8}
                        marginBottom={8}
                    >
                        <GtkLabel
                            label="This content slides down when revealed."
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        />
                    </GtkBox>
                </GtkRevealer>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Slide Up" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    heightRequest={80}
                >
                    <GtkRevealer
                        revealChild={slideUp}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
                        transitionDuration={300}
                        valign={Gtk.Align.END}
                    >
                        <GtkLabel
                            label="This content slides up!"
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        />
                    </GtkRevealer>
                </GtkBox>
                <GtkButton label={slideUp ? "Hide" : "Show"} onClicked={() => setSlideUp((v) => !v)} />
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Horizontal Slides" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkBox orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <GtkButton
                        label={slideLeft ? "Hide Left" : "Show Left"}
                        onClicked={() => setSlideLeft((v) => !v)}
                    />
                    <GtkRevealer
                        revealChild={slideLeft}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
                        transitionDuration={300}
                    >
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                            <GtkLabel
                                label="Left content"
                                marginStart={12}
                                marginEnd={12}
                                marginTop={8}
                                marginBottom={8}
                            />
                        </GtkBox>
                    </GtkRevealer>
                    <GtkRevealer
                        revealChild={slideRight}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
                        transitionDuration={300}
                    >
                        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                            <GtkLabel
                                label="Right content"
                                marginStart={12}
                                marginEnd={12}
                                marginTop={8}
                                marginBottom={8}
                            />
                        </GtkBox>
                    </GtkRevealer>
                    <GtkButton
                        label={slideRight ? "Hide Right" : "Show Right"}
                        onClicked={() => setSlideRight((v) => !v)}
                    />
                </GtkBox>
            </GtkBox>

            <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <GtkLabel label="Crossfade" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <GtkButton label={crossfade ? "Hide" : "Show"} onClicked={() => setCrossfade((v) => !v)} />
                <GtkRevealer
                    revealChild={crossfade}
                    transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                    transitionDuration={500}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]} marginTop={8}>
                        <GtkLabel
                            label="This content fades in and out smoothly."
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        />
                    </GtkBox>
                </GtkRevealer>
            </GtkBox>
        </GtkBox>
    );
};

export const revealerDemo: Demo = {
    id: "revealer",
    title: "Revealer",
    description: "Animate showing and hiding of child widgets.",
    keywords: ["revealer", "animation", "show", "hide", "transition", "GtkRevealer"],
    component: RevealerDemo,
    sourcePath: getSourcePath(import.meta.url, "revealer.tsx"),
};
