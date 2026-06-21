import { type GTyped, requireWrapperClass, resolveWrapperClass } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { typeChainIncludes } from "./gtype.js";

export type { GTyped };

export const hasType = (instance: GTyped, typeName: string): boolean => typeChainIncludes(instance.__gtype__, typeName);

export const classHasType = (cls: AnyClass<GTyped> | null, typeName: string): boolean =>
    cls !== null && typeChainIncludes(cls.prototype.__gtype__, typeName);

export interface AdwDialogLike extends GTyped {
    present(parent: Gtk.Widget | null): void;
    forceClose(): void;
}

export const isAdwDialog = <T extends GTyped>(instance: T): instance is T & AdwDialogLike =>
    hasType(instance, "AdwDialog");

export const resolveBackingClass = (typeName: string): AnyClass<GTyped> | null => resolveWrapperClass(typeName);

const describeUnregistered = (typeName: string): string =>
    `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`;

export const requireClassByName = (typeName: string): AnyClass<GTyped> =>
    requireWrapperClass(typeName, describeUnregistered);
