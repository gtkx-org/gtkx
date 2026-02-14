import * as Adw from "@gtkx/ffi/adw";
import type * as Gdk from "@gtkx/ffi/gdk";
import * as Gtk from "@gtkx/ffi/gtk";
import * as Pango from "@gtkx/ffi/pango";
import {
    AdwAlertDialog,
    createPortal,
    GtkBox,
    GtkButton,
    GtkHeaderBar,
    GtkLabel,
    GtkToggleButton,
    x,
} from "@gtkx/react";
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { Demo, DemoProps } from "../types.js";
import sourceCode from "./themes.tsx?raw";

interface Theme {
    name: string;
    dark: boolean;
}

const THEMES: Theme[] = [
    { name: "Adwaita", dark: false },
    { name: "Adwaita", dark: true },
    { name: "HighContrast", dark: false },
    { name: "HighContrastInverse", dark: false },
];

const ThemesDemo = ({ window }: DemoProps) => {
    const [isRunning, setIsRunning] = useState(false);
    const [fps, setFps] = useState("");
    const [showWarning, setShowWarning] = useState(false);
    const fpsAttrs = useMemo(() => {
        const attrs = new Pango.AttrList();
        attrs.insert(Pango.attrFontFeaturesNew("tnum=1"));
        return attrs;
    }, []);
    const themeIndexRef = useRef(0);
    const tickIdRef = useRef<number | null>(null);
    const boxRef = useRef<Gtk.Box | null>(null);
    const originalSettingsRef = useRef<{ themeName: string; colorScheme: Adw.ColorScheme } | null>(null);

    useLayoutEffect(() => {
        const settings = Gtk.Settings.getDefault();
        const styleManager = Adw.StyleManager.getDefault();
        if (settings && styleManager) {
            originalSettingsRef.current = {
                themeName: settings.getGtkThemeName(),
                colorScheme: styleManager.getColorScheme(),
            };
        }

        const win = window.current;
        if (win) {
            win.setResizable(false);
        }

        return () => {
            if (win && tickIdRef.current !== null) {
                win.removeTickCallback(tickIdRef.current);
                tickIdRef.current = null;
            }
            const original = originalSettingsRef.current;
            if (original && settings && styleManager) {
                settings.setGtkThemeName(original.themeName);
                styleManager.setColorScheme(original.colorScheme);
            }
        };
    }, [window]);

    const tickCallback = useCallback(
        (_widget: Gtk.Widget, frameClock: Gdk.FrameClock): boolean => {
            const settings = Gtk.Settings.getDefault();
            const styleManager = Adw.StyleManager.getDefault();
            if (!settings || !styleManager) return true;

            const theme = THEMES[themeIndexRef.current % THEMES.length];
            if (theme) {
                settings.setGtkThemeName(theme.name);
                styleManager.setColorScheme(theme.dark ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT);

                const win = window.current;
                if (win) {
                    const darkSuffix = theme.dark ? " (dark)" : "";
                    win.setTitle(`${theme.name}${darkSuffix}`);
                }
            }

            themeIndexRef.current++;

            const fpsValue = frameClock.getFps();
            setFps(`${fpsValue.toFixed(2)} fps`);

            return true;
        },
        [window],
    );

    const startCycling = useCallback(() => {
        const win = window.current;
        if (!win) return;

        tickIdRef.current = win.addTickCallback(tickCallback);
        setIsRunning(true);
    }, [window, tickCallback]);

    const stopCycling = useCallback(() => {
        const win = window.current;
        if (win && tickIdRef.current !== null) {
            win.removeTickCallback(tickIdRef.current);
            tickIdRef.current = null;
        }
        const original = originalSettingsRef.current;
        const settings = Gtk.Settings.getDefault();
        const styleManager = Adw.StyleManager.getDefault();
        if (original && settings && styleManager) {
            settings.setGtkThemeName(original.themeName);
            styleManager.setColorScheme(original.colorScheme);
        }
        setIsRunning(false);
        setFps("");
    }, [window]);

    const handleToggle = useCallback(
        (active: boolean) => {
            if (active) {
                setShowWarning(true);
            } else {
                stopCycling();
            }
        },
        [stopCycling],
    );

    const handleWarningResponse = useCallback(
        (response: string) => {
            setShowWarning(false);
            if (response === "ok") {
                startCycling();
            } else {
                setIsRunning(false);
            }
        },
        [startCycling],
    );

    return (
        <>
            <x.Slot for="GtkWindow" id="titlebar">
                <GtkHeaderBar>
                    <x.ContainerSlot for={GtkHeaderBar} id="packStart">
                        <GtkToggleButton
                            label="Cycle"
                            active={isRunning}
                            onToggled={(btn) => handleToggle(btn.getActive())}
                        />
                    </x.ContainerSlot>
                    <x.ContainerSlot for={GtkHeaderBar} id="packEnd">
                        <GtkLabel label={fps} widthChars={12} attributes={fpsAttrs} />
                    </x.ContainerSlot>
                </GtkHeaderBar>
            </x.Slot>
            <GtkBox
                ref={boxRef}
                orientation={Gtk.Orientation.VERTICAL}
                spacing={10}
                marginStart={10}
                marginEnd={10}
                marginTop={10}
                marginBottom={10}
            >
                <GtkBox cssClasses={["linked"]} halign={Gtk.Align.CENTER} valign={Gtk.Align.CENTER}>
                    <GtkButton label="Hi, I am a button" receivesDefault />
                    <GtkButton label="And I'm another button" receivesDefault />
                    <GtkButton label="This is a button party!" receivesDefault />
                </GtkBox>
                <GtkBox spacing={10}>
                    <GtkButton label="Plain" halign={Gtk.Align.END} hexpand vexpand />
                    <GtkButton label="Destructive" cssClasses={["destructive-action"]} />
                    <GtkButton label="Suggested" cssClasses={["suggested-action"]} />
                </GtkBox>
            </GtkBox>

            {showWarning &&
                window.current &&
                createPortal(
                    <AdwAlertDialog
                        heading="Warning"
                        body="This demo involves rapidly flashing changes and may be hazardous to photosensitive viewers."
                        defaultResponse="ok"
                        closeResponse="cancel"
                        onResponse={handleWarningResponse}
                    >
                        <x.AlertDialogResponse id="cancel" label="_Cancel" />
                        <x.AlertDialogResponse id="ok" label="_OK" />
                    </AdwAlertDialog>,
                    window.current,
                )}
        </>
    );
};

export const themesDemo: Demo = {
    id: "themes",
    title: "Benchmark/Themes",
    description:
        "This demo continuously switches themes, like some of you. Warning: This demo involves rapidly flashing changes and may be hazardous to photosensitive viewers.",
    keywords: ["benchmark", "themes", "performance", "fps", "GtkSettings"],
    component: ThemesDemo,
    sourceCode,
};
