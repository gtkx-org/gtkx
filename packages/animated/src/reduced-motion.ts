import * as Gtk from "@gtkx/gi/gtk";
import { Globals } from "@react-spring/core";
import { useSyncExternalStore } from "react";

type Listener = () => void;
type Tracker = { settings: Gtk.Settings | null; isReduced: boolean | null; areAnimationsEnabled: boolean };

const REDUCED_MOTION_MINOR = 22;
const tracker: Tracker = { settings: null, isReduced: null, areAnimationsEnabled: true };
const listeners: Set<Listener> = new Set();

const hasReducedMotionSetting = (): boolean => Gtk.checkVersion(4, REDUCED_MOTION_MINOR, 0) === null;

const isReduceMotionPreferred = (settings: Gtk.Settings): boolean =>
    hasReducedMotionSetting() && settings.gtkInterfaceReducedMotion === Gtk.ReducedMotion.REDUCE;

const sync = (): void => {
    const { settings } = tracker;

    if (settings === null) {
        return;
    }

    const areAnimationsEnabled = settings.gtkEnableAnimations;
    const isReduced = !areAnimationsEnabled || isReduceMotionPreferred(settings);

    if (areAnimationsEnabled !== tracker.areAnimationsEnabled) {
        tracker.areAnimationsEnabled = areAnimationsEnabled;
        Globals.assign({ skipAnimation: !areAnimationsEnabled });
    }

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
 * Tracks GTK's motion preferences and updates when they change.
 *
 * @returns `true` when animations are disabled or GTK 4.22+ requests reduced motion,
 * `false` otherwise, or `null` before a display opens.
 *
 * @remarks
 * `gtk-enable-animations: false` makes springs jump to their targets. GTKX sets React Spring's
 * `Globals.skipAnimation` only when that setting changes, so an application can set it for its own preference.
 * `gtk-interface-reduced-motion` leaves springs running for components to adapt;
 * it also drives GTK's `prefers-reduced-motion` media query.
 */
const useReducedMotion = (): boolean | null => useSyncExternalStore(subscribe, trackReducedMotion);

export { trackReducedMotion, useReducedMotion };
