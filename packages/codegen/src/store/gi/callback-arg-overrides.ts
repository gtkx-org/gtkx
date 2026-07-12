import { tObject } from "../../analysis/descriptor.js";
import type { ModuleContext } from "../../writer/context.js";

export type CallbackOverride = {
    argDescriptors: Map<number, string>;
    renderTsType: (context: ModuleContext) => string;
};

const itemComparator = (): CallbackOverride => ({
    argDescriptors: new Map([
        [0, tObject("borrowed")],
        [1, tObject("borrowed")],
    ]),
    renderTsType: (context) => {
        const object = context.qualify("GObject", "Object");
        return `(a: ${object} | null, b: ${object} | null) => number`;
    },
});

const CALLBACK_OVERRIDES: Map<string, CallbackOverride> = new Map([
    ["gtk_custom_sorter_new", itemComparator()],
    ["gtk_custom_sorter_set_sort_func", itemComparator()],
]);

export const getCallbackOverride = (cIdentifier: string | undefined): CallbackOverride | undefined =>
    cIdentifier === undefined ? undefined : CALLBACK_OVERRIDES.get(cIdentifier);
