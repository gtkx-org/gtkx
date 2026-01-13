import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkSpinner } from "@gtkx/react";
import { useEffect, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./spinner.tsx?raw";

const SpinnerDemo = () => {
    const [isSpinning, setIsSpinning] = useState(true);
    const [isLoading, setIsLoading] = useState(false);
    const [loadingProgress, setLoadingProgress] = useState(0);

    useEffect(() => {
        if (!isLoading) return;

        const interval = setInterval(() => {
            setLoadingProgress((prev) => {
                if (prev >= 100) {
                    setIsLoading(false);
                    return 0;
                }
                return prev + 10;
            });
        }, 500);

        return () => clearInterval(interval);
    }, [isLoading]);

    const handleStartLoading = () => {
        setLoadingProgress(0);
        setIsLoading(true);
    };

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Spinner" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkLabel
                label="GtkSpinner displays an animated spinning indicator, commonly used to show that an operation is in progress. It's a simple alternative to progress bars when the exact progress is unknown."
                wrap
                halign={Gtk.Align.START}
                cssClasses={["dim-label"]}
            />

            <GtkFrame label="Basic Spinner">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={24} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning={isSpinning} />
                        <GtkLabel label={isSpinning ? "Spinning..." : "Stopped"} />
                    </GtkBox>
                    <GtkButton
                        label={isSpinning ? "Stop" : "Start"}
                        onClicked={() => setIsSpinning(!isSpinning)}
                        halign={Gtk.Align.CENTER}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Spinner Sizes">
                <GtkBox
                    spacing={24}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                    halign={Gtk.Align.CENTER}
                >
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={16} heightRequest={16} />
                        <GtkLabel label="16px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={32} heightRequest={32} />
                        <GtkLabel label="32px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={48} heightRequest={48} />
                        <GtkLabel label="48px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                    <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={6} halign={Gtk.Align.CENTER}>
                        <GtkSpinner spinning widthRequest={64} heightRequest={64} />
                        <GtkLabel label="64px" cssClasses={["dim-label", "caption"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Loading Simulation">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12} halign={Gtk.Align.CENTER}>
                        {isLoading ? (
                            <>
                                <GtkSpinner spinning />
                                <GtkLabel label={`Loading... ${loadingProgress}%`} />
                            </>
                        ) : (
                            <GtkLabel
                                label={loadingProgress === 0 ? "Click to start loading" : "Loading complete!"}
                                cssClasses={loadingProgress === 0 ? ["dim-label"] : ["success"]}
                            />
                        )}
                    </GtkBox>
                    <GtkButton
                        label="Start Loading"
                        onClicked={handleStartLoading}
                        halign={Gtk.Align.CENTER}
                        sensitive={!isLoading}
                        cssClasses={["suggested-action"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Inline Usage">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={12}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={6}>
                        <GtkSpinner spinning widthRequest={16} heightRequest={16} />
                        <GtkLabel label="Processing your request..." />
                    </GtkBox>
                    <GtkBox spacing={6}>
                        <GtkSpinner spinning widthRequest={16} heightRequest={16} />
                        <GtkLabel label="Fetching data from server..." />
                    </GtkBox>
                    <GtkBox spacing={6}>
                        <GtkSpinner spinning widthRequest={16} heightRequest={16} />
                        <GtkLabel label="Saving changes..." />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const spinnerDemo: Demo = {
    id: "spinner",
    title: "Spinner",
    description: "Animated loading indicator",
    keywords: ["spinner", "loading", "progress", "animation", "GtkSpinner", "busy", "wait"],
    component: SpinnerDemo,
    sourceCode,
};
