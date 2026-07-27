import type * as Gdk from "@gtkx/gi/gdk";
import * as Adw from "@gtkx/gi/adw";
import * as GLib from "@gtkx/gi/glib";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { AdwAlertDialog } from "@gtkx/jsx/adw";
import { GtkBox, GtkButton, GtkHeaderBar, GtkLabel, GtkToggleButton } from "@gtkx/jsx/gtk";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Demo, DemoProviderProps } from "../types.js";
import { useTickCallback } from "../../use-tick-callback.js";
import sourceCode from "./themes.tsx?raw";

type Theme = {
    name: string;
    dark: boolean;
};

type OriginalSettingsRef = React.RefObject<{ themeName: string; colorScheme: Adw.ColorScheme } | null>;

type ThemesControls = {
    window: React.RefObject<Gtk.Window | null>;
    originalSettingsRef: OriginalSettingsRef;
    fpsRef: React.RefObject<string>;
    setIsRunning: (isRunning: boolean) => void;
    setFps: (fps: string) => void;
    setShowWarning: (isVisible: boolean) => void;
};

type ThemesContextValue = ReturnType<typeof useThemesCycling>;

const THEMES: Theme[] = [
    { name: "Adwaita", dark: false },
    { name: "Adwaita", dark: true },
    { name: "HighContrast", dark: false },
    { name: "HighContrastInverse", dark: false },
];

const FPS_POLL_MS = 500;
const ThemesContext = createContext<ThemesContextValue | null>(null);

const themesDemo: Demo = {
    id: "themes",
    title: "Benchmark/Themes",
    description:
        "This demo continuously switches themes, like some of you.\n\nWarning: This demo involves " +
        "rapidly flashing changes and may be hazardous to photosensitive viewers.",
    keywords: [],
    component: ThemesDemo,
    titlebar: ThemesTitlebar,
    provider: ThemesProvider,
    sourceCode,
    resizable: false,
};

const restoreOriginalSettings = (originalSettingsRef: OriginalSettingsRef) => {
    const original = originalSettingsRef.current;
    const settings = Gtk.Settings.getDefault();
    const styleManager = Adw.StyleManager.getDefault();

    if (original && settings) {
        settings.gtkThemeName = original.themeName;
        styleManager.setColorScheme(original.colorScheme);
    }
};

const colorSchemeFor = (theme: Theme): Adw.ColorScheme =>
    theme.dark ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT;

const titleFor = (theme: Theme): string => (theme.dark ? `${theme.name} (dark)` : theme.name);

const applyTheme = (theme: Theme, settings: Gtk.Settings, window: Gtk.Window | null): void => {
    settings.gtkThemeName = theme.name;
    Adw.StyleManager.getDefault().setColorScheme(colorSchemeFor(theme));

    if (window) {
        window.setTitle(titleFor(theme));
    }
};

const applyNextTheme = (
    window: React.RefObject<Gtk.Window | null>,
    themeIndexRef: React.RefObject<number>,
    frameClock: Gdk.FrameClock,
    fpsRef: React.RefObject<string>,
): void => {
    const settings = Gtk.Settings.getDefault();

    if (!settings) {
        return;
    }

    const theme = THEMES[themeIndexRef.current % THEMES.length];

    if (theme) {
        applyTheme(theme, settings, window.current);
    }

    themeIndexRef.current++;
    fpsRef.current = `${frameClock.getFps().toFixed(2)} fps`;
};

const stopCycling = (controls: ThemesControls): void => {
    restoreOriginalSettings(controls.originalSettingsRef);
    controls.setIsRunning(false);
    controls.fpsRef.current = "";
    controls.setFps("");
};

const toggleCycling = (controls: ThemesControls, isActive: boolean): void => {
    if (isActive) {
        controls.setShowWarning(true);

        return;
    }

    stopCycling(controls);
};

const respondToWarning = (controls: ThemesControls, response: string): void => {
    controls.setShowWarning(false);

    if (response !== "ok") {
        controls.setIsRunning(false);

        return;
    }

    if (controls.window.current) {
        controls.setIsRunning(true);
    }
};

const ThemesBody = ({ boxRef }: { boxRef: React.RefObject<Gtk.Box | null> }) => (
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
);

const ThemesWarningDialog = ({ onResponse }: { onResponse: (response: string) => void }) => (
    <AdwAlertDialog
        name="warning-dialog"
        heading="Warning"
        body="This demo involves rapidly flashing changes and may be hazardous to photosensitive viewers."
        defaultResponse="ok"
        closeResponse="cancel"
        responses={[
            { id: "cancel", label: "_Cancel" },
            { id: "ok", label: "_OK" },
        ]}
        onResponse={onResponse}
    />
);

function useThemesLifecycle(originalSettingsRef: OriginalSettingsRef) {
    useLayoutEffect(() => {
        const settings = Gtk.Settings.getDefault();
        const styleManager = Adw.StyleManager.getDefault();

        if (settings) {
            originalSettingsRef.current = {
                themeName: settings.gtkThemeName,
                colorScheme: styleManager.getColorScheme(),
            };
        }

        return () => {
            restoreOriginalSettings(originalSettingsRef);
        };
    }, [originalSettingsRef]);
}

function useFpsPolling(isRunning: boolean, fpsRef: React.RefObject<string>, setFps: (fps: string) => void) {
    useEffect(() => {
        if (!isRunning) {
            return;
        }

        const interval = setInterval(() => {
            setFps(fpsRef.current);
        }, FPS_POLL_MS);

        return () => {
            clearInterval(interval);
        };
    }, [isRunning, fpsRef, setFps]);
}

function useFpsAttrs() {
    return (() => {
        const attrs = Pango.AttrList.new();
        attrs.insert(Pango.AttrFontFeatures.new("tnum=1"));

        return attrs;
    })();
}

function useThemesCycling(window: React.RefObject<Gtk.Window | null>) {
    const [isRunning, setIsRunning] = useState(false);
    const [fps, setFps] = useState("");
    const [showWarning, setShowWarning] = useState(false);
    const fpsAttrs = useFpsAttrs();
    const themeIndexRef = useRef(0);
    const boxRef = useRef<Gtk.Box | null>(null);
    const originalSettingsRef = useRef<{ themeName: string; colorScheme: Adw.ColorScheme } | null>(null);
    const fpsRef = useRef("");
    const controls = { window, originalSettingsRef, fpsRef, setIsRunning, setFps, setShowWarning };
    useThemesLifecycle(originalSettingsRef);
    useFpsPolling(isRunning, fpsRef, setFps);

    useTickCallback(isRunning ? window : null, (_widget, frameClock) => {
        applyNextTheme(window, themeIndexRef, frameClock, fpsRef);

        return GLib.SOURCE_CONTINUE;
    });

    const handleToggle = (isActive: boolean) => {
        toggleCycling(controls, isActive);
    };

    const handleWarningResponse = (response: string) => {
        respondToWarning(controls, response);
    };

    return { isRunning, fps, showWarning, fpsAttrs, boxRef, handleToggle, handleWarningResponse };
}

function useThemes(): ThemesContextValue {
    const ctx = useContext(ThemesContext);

    if (!ctx) {
        throw new Error("useThemes must be used inside a ThemesProvider");
    }

    return ctx;
}

function ThemesProvider({ window, children }: DemoProviderProps) {
    const value = useThemesCycling(window);

    return <ThemesContext.Provider value={value}>{children}</ThemesContext.Provider>;
}

function ThemesTitlebar() {
    const cycling = useThemes();

    return (
        <GtkHeaderBar
            name="themes-header"
            start={(
                <GtkToggleButton
                    label="Cycle"
                    active={cycling.isRunning}
                    onToggled={(btn) => {
                        cycling.handleToggle(btn.getActive());
                    }}
                />
            )}
            end={(
                <GtkLabel widthChars={12} attributes={cycling.fpsAttrs}>
                    {cycling.fps}
                </GtkLabel>
            )}
        />
    );
}

function ThemesDemo() {
    const cycling = useThemes();

    return (
        <>
            <ThemesBody boxRef={cycling.boxRef} />
            {cycling.showWarning && <ThemesWarningDialog onResponse={cycling.handleWarningResponse} />}
        </>
    );
}

export { themesDemo };
