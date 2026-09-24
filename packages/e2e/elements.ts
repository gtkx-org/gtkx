import type * as Gtk from "@gtkx/gi/gtk";
import { defineBehavior, defineElements, mergeElementConfigs } from "@gtkx/react/config";

export default mergeElementConfigs(defineElements({
    GtkWidget: {
        behaviors: [
            {
                update: (widget: Gtk.Widget, prev, next) => {
                    const name = next.cursorName;

                    if (!Object.is(prev.cursorName, name)) {
                        widget.setCursorFromName(typeof name === "string" ? name : null);
                    }

                    return ["cursorName"];
                },
            },
        ],
    },
    GtkBox: {
        behaviors: [
            {
                update: (box: Gtk.Box, prev, next) => {
                    if (Object.is(prev.indexAugmented, next.indexAugmented)) {
                        return ["indexAugmented"];
                    }

                    if (next.indexAugmented === true) {
                        box.addCssClass("index-augmented");
                    } else {
                        box.removeCssClass("index-augmented");
                    }

                    return ["indexAugmented"];
                },
            },
        ],
    },
    GtkFrame: {
        behaviors: [
            {
                attach: (frame: Gtk.Frame, child, info) => {
                    if (info.slot !== "labelSlot") {
                        return;
                    }

                    frame.setLabelWidget(child as Gtk.Widget);

                    return true;
                },
                detach: (frame: Gtk.Frame, _child, info) => {
                    if (info.slot === "labelSlot") {
                        frame.setLabelWidget(null);
                    }
                },
            },
        ],
    },
    GtkAspectFrame: {
        behaviors: [
            {
                attach: (frame: Gtk.AspectFrame, child, info) => {
                    if (info.slot !== "children") {
                        return;
                    }

                    frame.addCssClass("app-claimed-children");
                    frame.setChild(child as Gtk.Widget);

                    return true;
                },
                detach: (frame: Gtk.AspectFrame, _child, info) => {
                    if (info.slot === "children") {
                        frame.setChild(null);
                    }
                },
            },
        ],
    },
}), defineElements({
    GtkFrame: {
        behaviors: [defineBehavior<Gtk.Frame>({
            update: (frame, prev, next) => {
                if (!Object.is(prev.customTooltip, next.customTooltip)) {
                    frame.setTooltipText((next.customTooltip as string | null | undefined) ?? null);
                }

                return ["customTooltip"];
            },
        })],
    },
}));
