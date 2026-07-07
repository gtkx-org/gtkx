import { AlertDialog, Dialog } from "@gtkx/components/adw";
import * as Adw from "@gtkx/gi/adw";
import type * as Gdk from "@gtkx/gi/gdk";
import * as Gtk from "@gtkx/gi/gtk";
import * as Pango from "@gtkx/gi/pango";
import { GtkBox, GtkButton, GtkHeaderBar, GtkLabel, GtkToggleButton } from "@gtkx/jsx/gtk";
import { useTickCallback } from "@gtkx/react";
import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { Demo, DemoProps, DemoProviderProps } from "../types.js";
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

type OriginalSettingsRef = React.RefObject<{ themeName: string; colorScheme: Adw.ColorScheme } | null>;

const restoreOriginalSettings = (originalSettingsRef: OriginalSettingsRef) => {
    const original = originalSettingsRef.current;
    const settings = Gtk.Settings.getDefault();
    const styleManager = Adw.StyleManager.getDefault();
    if (original && settings && styleManager) {
        settings.gtkThemeName = original.themeName;
        styleManager.setColorScheme(original.colorScheme);
    }
};

const applyNextTheme = (
    window: React.RefObject<Gtk.Window | null>,
    themeIndexRef: React.RefObject<number>,
    frameClock: Gdk.FrameClock,
    fpsRef: React.RefObject<string>,
): boolean => {
    const settings = Gtk.Settings.getDefault();
    const styleManager = Adw.StyleManager.getDefault();
    if (!settings || !styleManager) return true;

    const theme = THEMES[themeIndexRef.current % THEMES.length];
    if (theme) {
        settings.gtkThemeName = theme.name;
        styleManager.setColorScheme(theme.dark ? Adw.ColorScheme.FORCE_DARK : Adw.ColorScheme.FORCE_LIGHT);
        const win = window.current;
        if (win) {
            const darkSuffix = theme.dark ? " (dark)" : "";
            win.setTitle(`${theme.name}${darkSuffix}`);
        }
    }
    themeIndexRef.current++;
    fpsRef.current = `${frameClock.getFps().toFixed(2)} fps`;
    return true;
};

const FPS_POLL_MS = 500;

function useThemesLifecycle(originalSettingsRef: OriginalSettingsRef) {
    useLayoutEffect(() => {
        const settings = Gtk.Settings.getDefault();
        const styleManager = Adw.StyleManager.getDefault();
        if (settings && styleManager) {
            originalSettingsRef.current = {
                themeName: settings.gtkThemeName ?? "",
                colorScheme: styleManager.getColorScheme(),
            };
        }
        return () => restoreOriginalSettings(originalSettingsRef);
    }, [originalSettingsRef]);
}

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

const ThemesWarningDialog = ({
    window,
    onResponse,
}: {
    window: Gtk.Window;
    onResponse: (response: string) => void;
}) => (
    <Dialog parent={window}>
        <AlertDialog
            name="warning-dialog"
            heading="Warning"
            body="This demo involves rapidly flashing changes and may be hazardous to photosensitive viewers."
            defaultResponse="ok"
            closeResponse="cancel"
            onResponse={onResponse}
        >
            <AlertDialog.Response id="cancel" label="_Cancel" />
            <AlertDialog.Response id="ok" label="_OK" />
        </AlertDialog>
    </Dialog>
);

function useFpsAttrs() {
    return (() => {
        const attrs = Pango.AttrList.new();
        attrs.insert(Pango.attrFontFeaturesNew("tnum=1"));
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

    useThemesLifecycle(originalSettingsRef);

    useTickCallback(isRunning ? window : null, (_widget, frameClock) =>
        applyNextTheme(window, themeIndexRef, frameClock, fpsRef),
    );

    useEffect(() => {
        if (!isRunning) return;
        const interval = setInterval(() => setFps(fpsRef.current), FPS_POLL_MS);
        return () => clearInterval(interval);
    }, [isRunning]);

    const startCycling = () => {
        if (!window.current) return;
        setIsRunning(true);
    };

    const stopCycling = () => {
        restoreOriginalSettings(originalSettingsRef);
        setIsRunning(false);
        fpsRef.current = "";
        setFps("");
    };

    const handleToggle = (active: boolean) => {
        if (active) setShowWarning(true);
        else stopCycling();
    };

    const handleWarningResponse = (response: string) => {
        setShowWarning(false);
        if (response === "ok") startCycling();
        else setIsRunning(false);
    };

    return { isRunning, fps, showWarning, fpsAttrs, boxRef, handleToggle, handleWarningResponse };
}

type ThemesContextValue = ReturnType<typeof useThemesCycling>;

const ThemesContext = createContext<ThemesContextValue | null>(null);

const useThemes = (): ThemesContextValue => {
    const ctx = useContext(ThemesContext);
    if (!ctx) throw new Error("useThemes must be used inside a ThemesProvider");
    return ctx;
};

const ThemesProvider = ({ window, children }: DemoProviderProps) => {
    const value = useThemesCycling(window);
    return <ThemesContext.Provider value={value}>{children}</ThemesContext.Provider>;
};

const ThemesTitlebar = () => {
    const cycling = useThemes();
    return (
        <GtkHeaderBar
            name="themes-header"
            start={
                <GtkToggleButton
                    label="Cycle"
                    active={cycling.isRunning}
                    onToggled={(btn) => cycling.handleToggle(btn.getActive())}
                />
            }
            end={<GtkLabel label={cycling.fps} widthChars={12} attributes={cycling.fpsAttrs} />}
        />
    );
};

const ThemesDemo = ({ window }: DemoProps) => {
    const cycling = useThemes();
    return (
        <>
            <ThemesBody boxRef={cycling.boxRef} />
            {cycling.showWarning && window.current && (
                <ThemesWarningDialog window={window.current} onResponse={cycling.handleWarningResponse} />
            )}
        </>
    );
};

export const themesDemo: Demo = {
    id: "themes",
    title: "Benchmark/Themes",
    description:
        "This demo continuously switches themes, like some of you.\n\nWarning: This demo involves rapidly flashing changes and may be hazardous to photosensitive viewers.",
    keywords: [],
    component: ThemesDemo,
    titlebar: ThemesTitlebar,
    provider: ThemesProvider,
    sourceCode,
    resizable: false,
};
