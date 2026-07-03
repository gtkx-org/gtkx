import { requireWrapperClassByName, type TypedClass } from "@gtkx/ffi";
import type * as Gtk from "@gtkx/gi/gtk";
import type { AnyClass } from "@gtkx/utils";
import { typeChainIncludes } from "./gtype.js";

export type { TypedClass };

export const hasType = (instance: TypedClass, typeName: string): boolean =>
    typeChainIncludes(instance.__type__, typeName);

export const classHasType = (cls: AnyClass<TypedClass> | null, typeName: string): boolean =>
    cls !== null && typeChainIncludes(cls.prototype.__type__, typeName);

export type AdwDialogLike = TypedClass & {
    present(parent: Gtk.Widget | null): void;
    forceClose(): void;
};

export const isAdwDialog = <T extends TypedClass>(instance: T): instance is T & AdwDialogLike =>
    hasType(instance, "AdwDialog");

const describeUnregistered = (typeName: string): string =>
    `${typeName} is not registered. Import its @gtkx/jsx namespace module (e.g. \`import "@gtkx/jsx/adw"\`) before use.`;

export const requireClassByName = (typeName: string): AnyClass<TypedClass> =>
    requireWrapperClassByName(typeName, describeUnregistered);
