import * as Gtk from "@gtkx/gi/gtk";
import { Globals } from "@react-spring/core";
import { useSyncExternalStore } from "react";

type Listener = () => void;
type Tracker = { settings: Gtk.Settings | null; isReduced: boolean | null };

const REDUCED_MOTION_MINOR = 22;
const tracker: Tracker = { settings: null, isReduced: null };
const listeners: Set<Listener> = new Set();

const hasReducedMotionSetting = (): boolean => Gtk.checkVersion(4, REDUCED_MOTION_MINOR, 0) === null;

const isReduceMotionPreferred = (settings: Gtk.Settings): boolean =>
    hasReducedMotionSetting() && settings.gtkInterfaceReducedMotion === Gtk.ReducedMotion.REDUCE;

const sync = (): void => {
    const { settings } = tracker;

    if (settings === null) {
        return;
    }

    const isReduced = !settings.gtkEnableAnimations || isReduceMotionPreferred(settings);
    Globals.assign({ skipAnimation: !settings.gtkEnableAnimations });

    if (isReduced === tracker.isReduced) {
        return;
    }

    tracker.isReduced = isReduced;

    for (const listener of listeners) {
        listener();
    }
};

const watch = (settings: Gtk.Settings): void => {
    tracker.settings = settings;
    settings.on("notify::gtk-enable-animations", sync);

    if (hasReducedMotionSetting()) {
        settings.on("notify::gtk-interface-reduced-motion", sync);
    }

    sync();
};

const trackReducedMotion = (): boolean | null => {
    if (tracker.settings === null) {
        const settings = Gtk.Settings.getDefault();

        if (settings === null) {
            return null;
        }

        watch(settings);
    }

    return tracker.isReduced;
};

const subscribe = (listener: Listener): (() => void) => {
    listeners.add(listener);

    return () => {
        listeners.delete(listener);
    };
};

/**
 * Reports whether the desktop asks for less motion: `true` while GTK's `gtk-enable-animations`
 * setting is off, which is when every spring already jumps straight to its target, and also while
 * the `gtk-interface-reduced-motion` setting of GTK 4.22 asks to reduce motion, the preference
 * behind the `prefers-reduced-motion` media query, which leaves springs running so that components
 * can trade a slide for a fade themselves. Returns `null` until a display is open.
 *
 * @returns `true` when motion should be reduced, `false` when it should not, `null` when unknown.
 */
const useReducedMotion = (): boolean | null => useSyncExternalStore(subscribe, trackReducedMotion);

export { trackReducedMotion, useReducedMotion };
