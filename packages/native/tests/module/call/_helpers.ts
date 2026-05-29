import { call } from "../../../index.js";
import type { Type } from "../../../types.js";
import { BOOLEAN, GOBJECT_BORROWED, GTK_LIB, VOID } from "../utils.js";

export function setLabelSelectable(label: unknown, value: boolean): void {
    call(
        GTK_LIB,
        "gtk_label_set_selectable",
        [
            { type: GOBJECT_BORROWED, value: label },
            { type: BOOLEAN, value },
        ],
        VOID,
    );
}

export function getLabelSelectable(label: unknown): boolean {
    return call(GTK_LIB, "gtk_label_get_selectable", [{ type: GOBJECT_BORROWED, value: label }], BOOLEAN) as boolean;
}

export function setAndGetLabelMaxWidthChars(label: unknown, type: Type, value: number): number {
    call(
        GTK_LIB,
        "gtk_label_set_max_width_chars",
        [
            { type: GOBJECT_BORROWED, value: label },
            { type, value },
        ],
        VOID,
    );
    return call(GTK_LIB, "gtk_label_get_max_width_chars", [{ type: GOBJECT_BORROWED, value: label }], type) as number;
}
