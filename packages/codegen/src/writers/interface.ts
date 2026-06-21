import { toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indentMembers, renderBlock, renderBracedOrEmpty } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import {
    type Callables,
    dedupeCallables,
    emitBindings,
    indexMethodsByName,
    renderInstanceMethod,
    renderInstanceMethodSignature,
    renderStaticHead,
} from "./callables.js";
import { renderVfuncMetadata } from "./class-struct.js";
import { gtypeExprFor } from "./gtype-binding.js";
import { resolvePrerequisiteReference } from "./inheritance.js";
import { methodExportName } from "./method.js";
import { renderPropertyAccessor, renderPropertyAccessorSignature } from "./property-accessor.js";
import { appendInterfaceRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";

export const emitInterface = (context: ModuleContext, iface: GirClass): void => {
    if (!iface.introspectable) return;
    if (iface.name.length === 0) return;
    const className = toPascalCase(iface.name);
    const callables: Callables = {
        constructors: dedupeCallables(iface.constructors),
        functions: dedupeCallables(iface.functions),
        methods: dedupeCallables(iface.methods),
    };
    emitBindings(context, callables);

    const gtypeExpr = gtypeExprFor(context, iface);

    context.module.appendDeclaration(renderInterfaceType(context, iface, className, callables));
    context.module.appendDeclaration(renderInterfaceClass(context, className, callables, gtypeExpr));
    for (const declaration of renderSignalDeclarations(context, iface, className, true)) {
        context.module.appendDeclaration(declaration);
    }
    context.module.appendDeclaration(renderInterfaceMaker(context, iface, className, callables));

    appendInterfaceRegistration(context, {
        className,
        makerName: makerName(className),
        gtypeExpr,
        vfuncs: renderVfuncMetadata(context, iface),
    });
};

const makerName = (className: string): string => `make${className}`;

const interfaceTypeExtends = (context: ModuleContext, iface: GirClass): string => {
    const refs = iface.prerequisites
        .map((name) => resolvePrerequisiteReference(context, name))
        .filter((entry): entry is string => entry !== undefined);
    if (refs.length > 0) return refs.join(", ");
    return context.qualify("GObject", "Object");
};

const renderInterfaceType = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
    callables: Callables,
): string => {
    const members = renderInterfaceTypeMembers(context, iface, callables);
    return renderBracedOrEmpty(
        `export interface ${className} extends ${interfaceTypeExtends(context, iface)}`,
        members.join("\n"),
    );
};

const renderInterfaceTypeMembers = (context: ModuleContext, iface: GirClass, callables: Callables): string[] => {
    const members: string[] = [];
    const claimedNames = new Set<string>();
    for (const callable of callables.methods) {
        const signature = renderInstanceMethodSignature(context, callable);
        if (signature === undefined) continue;
        members.push(signature);
        claimedNames.add(methodExportName(callable));
    }
    const methodByName = indexMethodsByName(callables.methods);
    for (const property of iface.properties) {
        const signature = renderPropertyAccessorSignature({ context, property, claimedNames, methodByName });
        if (signature !== undefined) members.push(signature);
    }
    return members;
};

const renderInterfaceClass = (
    context: ModuleContext,
    className: string,
    callables: Callables,
    gtypeExpr: string | undefined,
): string => {
    const members: string[] = [];
    if (gtypeExpr !== undefined) members.push(renderInterfaceHasInstance(context, className, gtypeExpr));
    members.push(...renderStaticHead(context, callables, className));
    const body = indentMembers(members);
    return body.length === 0
        ? `export abstract class ${className} {}`
        : `export abstract class ${className} {\n${body}\n}`;
};

const renderInterfaceHasInstance = (context: ModuleContext, className: string, gtypeExpr: string): string => {
    context.addRuntimeImport("valueIsA");
    return renderBlock(
        `static [Symbol.hasInstance](value: unknown): value is ${className}`,
        `return valueIsA(value, ${gtypeExpr});`,
    );
};

const renderInterfaceMaker = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
    callables: Callables,
): string => {
    context.addRuntimeTypeImport("Mixin");
    const members = renderInterfaceInstanceMembers(context, iface, callables);
    const body = indentMembers(members);
    const classExpression = body.length === 0 ? "class extends Base {}" : `class extends Base {\n${body}\n}`;
    return `export const ${makerName(className)}: Mixin = (Base) =>\n${classExpression};`;
};

const renderInterfaceInstanceMembers = (context: ModuleContext, iface: GirClass, callables: Callables): string[] => {
    const members: string[] = [];
    const claimedNames = new Set<string>();
    for (const callable of callables.methods) {
        const block = renderInstanceMethod(context, callable);
        if (block === undefined) continue;
        members.push(block);
        claimedNames.add(methodExportName(callable));
    }
    const methodByName = indexMethodsByName(callables.methods);
    for (const property of iface.properties) {
        const block = renderPropertyAccessor({ context, property, claimedNames, methodByName });
        if (block !== undefined) members.push(block);
    }
    members.push(...renderSignalMembers(context, iface));
    return members;
};
