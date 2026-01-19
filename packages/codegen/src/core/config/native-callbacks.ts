import type { CallbackType } from "@gtkx/native";

export type CallbackName = CallbackType["kind"];

export const APPLICATION_PARAM_NAME = "application";

const NATIVE_CALLBACKS: Record<string, CallbackName> = {
    "Adw.AnimationTargetFunc": "animationTargetFunc",
    "Gio.AsyncReadyCallback": "asyncReadyCallback",
    "GLib.DestroyNotify": "destroyNotify",
    "Gsk.PathIntersectionFunc": "pathIntersectionFunc",
    "Gtk.DrawingAreaDrawFunc": "drawingAreaDrawFunc",
    "Gtk.ScaleFormatValueFunc": "scaleFormatValueFunc",
    "Gtk.ShortcutFunc": "shortcutFunc",
    "Gtk.TickCallback": "tickCallback",
    "Gtk.TreeListModelCreateModelFunc": "treeListModelCreateModelFunc",
    "PangoCairo.ShapeRendererFunc": "shapeRendererFunc",
};

export const getNativeCallbackName = (qualifiedName: string): CallbackName | null => {
    return NATIVE_CALLBACKS[qualifiedName] ?? null;
};

export const isSupportedCallback = (typeName: string): boolean => {
    return typeName in NATIVE_CALLBACKS;
};
