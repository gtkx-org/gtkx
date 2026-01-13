import * as Adw from "@gtkx/ffi/adw";
import { ColorScheme } from "@gtkx/ffi/adw";
import * as Gtk from "@gtkx/ffi/gtk";
import { GtkBox, GtkButton, GtkFrame, GtkLabel, GtkScale } from "@gtkx/react";
import { useEffect, useMemo, useRef, useState } from "react";
import type { Demo } from "../types.js";
import sourceCode from "./themes.tsx?raw";

const colorSchemes: ColorScheme[] = [
    ColorScheme.FORCE_LIGHT,
    ColorScheme.FORCE_DARK,
    ColorScheme.PREFER_LIGHT,
    ColorScheme.PREFER_DARK,
];

const colorSchemeNames: Record<ColorScheme, string> = {
    [ColorScheme.DEFAULT]: "Default",
    [ColorScheme.FORCE_LIGHT]: "Force Light",
    [ColorScheme.FORCE_DARK]: "Force Dark",
    [ColorScheme.PREFER_LIGHT]: "Prefer Light",
    [ColorScheme.PREFER_DARK]: "Prefer Dark",
};

function setColorScheme(scheme: ColorScheme) {
    const styleManager = Adw.StyleManager.getDefault();
    styleManager.setColorScheme(scheme);
}

const ThemesDemo = () => {
    const [isRunning, setIsRunning] = useState(false);
    const [fps, setFps] = useState(0);
    const [currentSchemeIndex, setCurrentSchemeIndex] = useState(0);
    const [intervalMs, setIntervalMs] = useState(100);
    const frameCountRef = useRef(0);
    const lastTimeRef = useRef(Date.now());
    const originalSchemeRef = useRef<ColorScheme | null>(null);

    useEffect(() => {
        const styleManager = Adw.StyleManager.getDefault();
        if (!originalSchemeRef.current) {
            originalSchemeRef.current = styleManager.getColorScheme();
        }
    }, []);

    useEffect(() => {
        if (!isRunning) return;

        const interval = setInterval(() => {
            const nextIndex = (currentSchemeIndex + 1) % colorSchemes.length;
            const scheme = colorSchemes[nextIndex];
            if (scheme !== undefined) {
                setColorScheme(scheme);
                setCurrentSchemeIndex(nextIndex);
            }

            frameCountRef.current++;
            const now = Date.now();
            const elapsed = now - lastTimeRef.current;
            if (elapsed >= 1000) {
                setFps(Math.round((frameCountRef.current * 1000) / elapsed));
                frameCountRef.current = 0;
                lastTimeRef.current = now;
            }
        }, intervalMs);

        return () => clearInterval(interval);
    }, [isRunning, currentSchemeIndex, intervalMs]);

    const handleStop = () => {
        setIsRunning(false);
        if (originalSchemeRef.current !== null) {
            setColorScheme(originalSchemeRef.current);
        }
    };

    const intervalAdjustment = useMemo(() => new Gtk.Adjustment(100, 10, 1000, 10, 100, 0), []);

    const currentScheme = colorSchemes[currentSchemeIndex];
    const styleManager = Adw.StyleManager.getDefault();
    const isDark = styleManager.getDark();

    return (
        <GtkBox orientation={Gtk.Orientation.VERTICAL} spacing={24}>
            <GtkLabel label="Benchmark: Themes" cssClasses={["title-2"]} halign={Gtk.Align.START} />

            <GtkFrame label="Warning">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="This benchmark rapidly switches between themes, which may cause flashing. If you have photosensitivity issues, please do not run this demo."
                        wrap
                        halign={Gtk.Align.START}
                        cssClasses={["warning"]}
                    />
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Controls">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={16}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Switch Interval (ms):" halign={Gtk.Align.START} />
                        <GtkScale
                            hexpand
                            drawValue
                            valuePos={Gtk.PositionType.RIGHT}
                            digits={0}
                            adjustment={intervalAdjustment}
                            onValueChanged={(scale: Gtk.Range) => setIntervalMs(Math.round(scale.getValue()))}
                            sensitive={!isRunning}
                        />
                    </GtkBox>

                    <GtkBox spacing={12}>
                        <GtkButton
                            label={isRunning ? "Stop" : "Start Benchmark"}
                            onClicked={() => (isRunning ? handleStop() : setIsRunning(true))}
                            cssClasses={[isRunning ? "destructive-action" : "suggested-action"]}
                        />
                        <GtkLabel label={`FPS: ${fps}`} cssClasses={["monospace"]} valign={Gtk.Align.CENTER} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="Current Color Scheme">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkBox spacing={12}>
                        <GtkLabel label="Color Scheme:" widthChars={14} xalign={0} />
                        <GtkLabel
                            label={currentScheme !== undefined ? colorSchemeNames[currentScheme] : "Unknown"}
                            cssClasses={["monospace"]}
                        />
                    </GtkBox>
                    <GtkBox spacing={12}>
                        <GtkLabel label="Current Mode:" widthChars={14} xalign={0} />
                        <GtkLabel label={isDark ? "Dark" : "Light"} cssClasses={["monospace"]} />
                    </GtkBox>
                </GtkBox>
            </GtkFrame>

            <GtkFrame label="About This Benchmark">
                <GtkBox
                    orientation={Gtk.Orientation.VERTICAL}
                    spacing={8}
                    marginTop={12}
                    marginBottom={12}
                    marginStart={12}
                    marginEnd={12}
                >
                    <GtkLabel
                        label="This benchmark stress-tests libadwaita's color scheme switching performance by rapidly cycling through available color schemes using AdwStyleManager.setColorScheme()."
                        wrap
                        halign={Gtk.Align.START}
                    />
                    <GtkLabel
                        label="The FPS counter shows how many color scheme switches occur per second. Higher values indicate better theme switching performance."
                        wrap
                        halign={Gtk.Align.START}
                        marginTop={8}
                        cssClasses={["dim-label"]}
                    />
                </GtkBox>
            </GtkFrame>
        </GtkBox>
    );
};

export const themesDemo: Demo = {
    id: "themes",
    title: "Benchmark/Themes",
    description: "Stress test theme switching performance",
    keywords: ["benchmark", "themes", "performance", "fps", "stress test", "dark mode"],
    component: ThemesDemo,
    sourceCode,
};
