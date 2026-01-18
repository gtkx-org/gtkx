import type { TrampolineName } from "@gtkx/native";

export type { TrampolineName };

export const APPLICATION_PARAM_NAME = "application";

const CALLBACK_TRAMPOLINES: Record<string, TrampolineName> = {
    "Adw.AnimationTargetFunc": "animationTargetFunc",
    "Gio.AsyncReadyCallback": "asyncReady",
    "GLib.DestroyNotify": "destroy",
    "Gsk.PathIntersectionFunc": "pathIntersectionFunc",
    "Gtk.DrawingAreaDrawFunc": "drawFunc",
    "Gtk.ScaleFormatValueFunc": "scaleFormatValueFunc",
    "Gtk.ShortcutFunc": "shortcutFunc",
    "Gtk.TickCallback": "tickCallback",
    "Gtk.TreeListModelCreateModelFunc": "treeListModelCreateFunc",
};

export const getTrampolineName = (qualifiedName: string): TrampolineName | null => {
    return CALLBACK_TRAMPOLINES[qualifiedName] ?? null;
};

export const isSupportedCallback = (typeName: string): boolean => {
    return typeName in CALLBACK_TRAMPOLINES;
};
