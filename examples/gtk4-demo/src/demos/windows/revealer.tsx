import * as Gtk from "@gtkx/ffi/gtk";
import { Box, Button, Label, Revealer } from "@gtkx/react";
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
        <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginStart={20} marginEnd={20} marginTop={20}>
            <Label label="Revealer" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Slide Down" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Button label={slideDown ? "Hide" : "Show"} onClicked={() => setSlideDown((v) => !v)} />
                <Revealer
                    revealChild={slideDown}
                    transitionType={Gtk.RevealerTransitionType.SLIDE_DOWN}
                    transitionDuration={300}
                >
                    <Box
                        orientation={Gtk.Orientation.VERTICAL}
                        spacing={0}
                        cssClasses={["card"]}
                        marginTop={8}
                        marginBottom={8}
                    >
                        <Label
                            label="This content slides down when revealed."
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        />
                    </Box>
                </Revealer>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Slide Up" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={0}
                    cssClasses={["card"]}
                    marginTop={8}
                    marginBottom={8}
                    heightRequest={80}
                >
                    <Revealer
                        revealChild={slideUp}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_UP}
                        transitionDuration={300}
                        valign={Gtk.Align.END}
                    >
                        <Label
                            label="This content slides up!"
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        />
                    </Revealer>
                </Box>
                <Button label={slideUp ? "Hide" : "Show"} onClicked={() => setSlideUp((v) => !v)} />
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Horizontal Slides" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Box orientation={Gtk.Orientation.HORIZONTAL} spacing={12}>
                    <Button label={slideLeft ? "Hide Left" : "Show Left"} onClicked={() => setSlideLeft((v) => !v)} />
                    <Revealer
                        revealChild={slideLeft}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_RIGHT}
                        transitionDuration={300}
                    >
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                            <Label
                                label="Left content"
                                marginStart={12}
                                marginEnd={12}
                                marginTop={8}
                                marginBottom={8}
                            />
                        </Box>
                    </Revealer>
                    <Revealer
                        revealChild={slideRight}
                        transitionType={Gtk.RevealerTransitionType.SLIDE_LEFT}
                        transitionDuration={300}
                    >
                        <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]}>
                            <Label
                                label="Right content"
                                marginStart={12}
                                marginEnd={12}
                                marginTop={8}
                                marginBottom={8}
                            />
                        </Box>
                    </Revealer>
                    <Button
                        label={slideRight ? "Hide Right" : "Show Right"}
                        onClicked={() => setSlideRight((v) => !v)}
                    />
                </Box>
            </Box>

            <Box orientation={Gtk.Orientation.VERTICAL} spacing={12}>
                <Label label="Crossfade" cssClasses={["heading"]} halign={Gtk.Align.START} />
                <Button label={crossfade ? "Hide" : "Show"} onClicked={() => setCrossfade((v) => !v)} />
                <Revealer
                    revealChild={crossfade}
                    transitionType={Gtk.RevealerTransitionType.CROSSFADE}
                    transitionDuration={500}
                >
                    <Box orientation={Gtk.Orientation.VERTICAL} spacing={0} cssClasses={["card"]} marginTop={8}>
                        <Label
                            label="This content fades in and out smoothly."
                            marginStart={12}
                            marginEnd={12}
                            marginTop={12}
                            marginBottom={12}
                        />
                    </Box>
                </Revealer>
            </Box>
        </Box>
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
