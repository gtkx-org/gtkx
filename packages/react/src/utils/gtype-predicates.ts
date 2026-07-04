import { getWrapperClass, type TypedClass } from "@gtkx/ffi";
import * as GObject from "@gtkx/gi/gobject";
import type * as Gtk from "@gtkx/gi/gtk";
import { typeChainIncludes } from "./gtype.js";

export type { TypedClass };

export const hasType = (instance: TypedClass, typeName: string): boolean =>
    typeChainIncludes(instance.__type__, typeName);

export type AdwDialogLike = TypedClass & {
    present(parent: Gtk.Widget | null): void;
    forceClose(): void;
};

export const isAdwDialog = <T extends TypedClass>(instance: T): instance is T & AdwDialogLike =>
    hasType(instance, "AdwDialog");

const describeUnregistered = (typeName: string): string =>
    `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`;

export const requireClassByName = (typeName: string): (new (props: Record<string, unknown>) => GObject.Object) => {
    const gtype = GObject.typeFromName(typeName);
    if (gtype === GObject.TYPE_INVALID) throw new Error(describeUnregistered(typeName));
    return getWrapperClass(gtype) as new (
        props: Record<string, unknown>,
    ) => GObject.Object;
};
