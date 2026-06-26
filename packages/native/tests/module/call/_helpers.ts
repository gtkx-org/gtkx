import type { Type, Value } from "../../../types.js";
import { BOOLEAN, callArgs, GOBJECT_BORROWED, GTK_LIB, VOID } from "../utils.js";

export function setLabelSelectable(label: Value, value: boolean): void {
    callArgs(
        GTK_LIB,
        "gtk_label_set_selectable",
        [
            { type: GOBJECT_BORROWED, value: label },
            { type: BOOLEAN, value },
        ],
        VOID,
    );
}

export function getLabelSelectable(label: Value): boolean {
    return callArgs(
        GTK_LIB,
        "gtk_label_get_selectable",
        [{ type: GOBJECT_BORROWED, value: label }],
        BOOLEAN,
    ) as boolean;
}

export function setAndGetLabelMaxWidthChars(label: Value, type: Type, value: number): number {
    callArgs(
        GTK_LIB,
        "gtk_label_set_max_width_chars",
        [
            { type: GOBJECT_BORROWED, value: label },
            { type, value },
        ],
        VOID,
    );
    return callArgs(
        GTK_LIB,
        "gtk_label_get_max_width_chars",
        [{ type: GOBJECT_BORROWED, value: label }],
        type,
    ) as number;
}
