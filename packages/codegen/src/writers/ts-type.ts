import type { ModuleContext } from "../dsl/context.js";
import { aliasExportName } from "../dsl/identifier.js";
import { PRIMITIVE_TS_TYPE } from "../gir/primitives.js";
import type { GirRepository } from "../gir/repository.js";
import type { GirType } from "../gir/type.js";
import type { TypeId } from "../gir/type-id.js";
import { gtypeTsType } from "./gtype-binding.js";

export type ReferenceName = {
    namespaceName: string;
    typeName: string;
};

export type TsTypeTarget = {
    containerStyle: "map" | "record";
    callbackType: string;
    byteArrayAsNumber: boolean;
    renderNamed: (resolved: GirType | undefined, name: ReferenceName) => string;
    renderGtype: () => string;
};

export const renderBaseTypeFor = (repository: GirRepository, target: TsTypeTarget, ref: TypeId | undefined): string => {
    if (ref === undefined) return "void";
    const type = repository.typeOf(ref);
    const name = repository.nameOf(ref);
    if (type === undefined) return renderNamedType(target, undefined, name);
    switch (type.kind) {
        case "primitive":
            return type.category === "gtype" ? target.renderGtype() : PRIMITIVE_TS_TYPE[type.category];
        case "varargs":
            return "unknown[]";
        case "callback":
        case "class":
        case "interface":
        case "boxed":
        case "enum":
        case "alias":
            return renderNamedType(target, type, name);
        case "carray":
            return `${renderBaseTypeFor(repository, target, type.element)}[]`;
        case "list":
            if (type.flavor === "gbytearray" && target.byteArrayAsNumber) return "number[]";
            return `${renderBaseTypeFor(repository, target, type.element)}[]`;
        case "hashtable": {
            const key = renderBaseTypeFor(repository, target, type.key);
            const value = renderBaseTypeFor(repository, target, type.value);
            return target.containerStyle === "record" ? `Record<${key}, ${value}>` : `Map<${key}, ${value}>`;
        }
    }
};

const renderNamedType = (
    target: TsTypeTarget,
    resolved: GirType | undefined,
    name: ReferenceName | undefined,
): string => {
    if (name === undefined) return resolved?.kind === "callback" ? target.callbackType : "unknown";
    return target.renderNamed(resolved, name);
};

const moduleTarget = (context: ModuleContext): TsTypeTarget => ({
    containerStyle: "map",
    callbackType: "((...args: any[]) => any)",
    byteArrayAsNumber: true,
    renderNamed: (resolved, name) =>
        resolved?.kind === "alias"
            ? context.qualify(name.namespaceName, aliasExportName(name.namespaceName, name.typeName))
            : context.qualify(name.namespaceName, name.typeName),
    renderGtype: () => gtypeTsType(context),
});

export const renderTsType = (context: ModuleContext, ref: TypeId | undefined, isNullable = false): string => {
    const base = renderBaseTypeFor(context.repository, moduleTarget(context), ref);
    return isNullable ? `${base} | null` : base;
};
