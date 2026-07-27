import { pascalCase } from "@gtkx/utils";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { ModuleContext } from "../../writer/context.js";
import { reservedSignalMemberRename, resolvePrerequisiteReference } from "../../analysis/inheritance.js";
import { renderJsDoc } from "../../writer/doc.js";
import { renderBlock, renderBracedOrEmpty } from "../../writer/emit.js";
import {
    type Callables,
    dedupeCallables,
    generateBindings,
    type InstanceScope,
    instanceScope,
    renderClassInstanceMember,
    renderInstanceMethodSignature,
    renderStaticHead,
} from "./callables.js";
import { renderSourceGtype } from "./gtype-binding.js";
import { methodExportName } from "./method.js";
import {
    type PropertyAccessorArgs,
    renderPropertyAccessor,
    renderPropertyAccessorSignature,
} from "./property-accessor.js";
import { appendInterfaceRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";
import { renderVfuncMetadata } from "./vtable.js";

type InterfaceMemberRenderers = {
    renderMethod: (
        context: ModuleContext,
        callable: GirFunction,
        scope: InstanceScope,
        nameOverride?: string,
    ) => string | undefined;
    renderProperty: (args: PropertyAccessorArgs) => string | undefined;
};

type MethodMemberOptions = {
    context: ModuleContext;
    className: string;
    scope: InstanceScope;
    callables: Callables;
    renderers: InterfaceMemberRenderers;
    claimedNames: Set<string>;
};

type PropertyMemberOptions = {
    context: ModuleContext;
    iface: GirClass;
    scope: InstanceScope;
    renderers: InterfaceMemberRenderers;
    claimedNames: Set<string>;
};

const generateInterface = (context: ModuleContext, iface: GirClass): void => {
    if (!iface.introspectable) {
        return;
    }

    if (iface.name.length === 0) {
        return;
    }

    const className = pascalCase(iface.name);

    const callables: Callables = {
        constructors: dedupeCallables(iface.constructors),
        functions: dedupeCallables(iface.functions),
        methods: dedupeCallables(iface.methods),
    };

    generateBindings(context, callables);
    const gtypeExpr = renderSourceGtype(context, iface);
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

    if (refs.length > 0) {
        return refs.join(", ");
    }

    return context.qualify("GObject", "Object");
};

const renderInterfaceType = (
    context: ModuleContext,
    iface: GirClass,
    className: string,
    callables: Callables,
): string => {
    const members = renderInterfaceTypeMembers(context, iface, callables);

    return `${renderJsDoc(iface.doc)}${renderBracedOrEmpty(
        `export interface ${className} extends ${interfaceTypeExtends(context, iface)}`,
        members.join("\n"),
    )}`;
};

const collectMethodMembers = (options: MethodMemberOptions): string[] => {
    const { context, className, scope, callables, renderers, claimedNames } = options;
    const members: string[] = [];

    for (const callable of callables.methods) {
        const rename = reservedSignalMemberRename(className, callable);
        const block = renderers.renderMethod(context, callable, scope, rename);

        if (block === undefined) {
            continue;
        }

        members.push(block);
        claimedNames.add(rename ?? methodExportName(callable));
    }

    return members;
};

const collectPropertyMembers = (options: PropertyMemberOptions): string[] => {
    const { context, iface, scope, renderers, claimedNames } = options;
    const members: string[] = [];

    for (const property of iface.properties) {
        const block = renderers.renderProperty({ context, property, claimedNames, methodByName: scope.methodByName });

        if (block !== undefined) {
            members.push(block);
        }
    }

    return members;
};

const renderInterfaceMembers = (
    context: ModuleContext,
    iface: GirClass,
    callables: Callables,
    renderers: InterfaceMemberRenderers,
): string[] => {
    const className = pascalCase(iface.name);
    const scope = instanceScope(className, callables);
    const claimedNames: Set<string> = new Set();
    const methodMembers = collectMethodMembers({ context, className, scope, callables, renderers, claimedNames });
    const propertyMembers = collectPropertyMembers({ context, iface, scope, renderers, claimedNames });

    return [...methodMembers, ...propertyMembers];
};

const renderInterfaceTypeMembers = (context: ModuleContext, iface: GirClass, callables: Callables): string[] =>
    renderInterfaceMembers(context, iface, callables, {
        renderMethod: renderInstanceMethodSignature,
        renderProperty: renderPropertyAccessorSignature,
    });

const renderInterfaceClass = (
    context: ModuleContext,
    className: string,
    callables: Callables,
    gtypeExpr: string | undefined,
): string => {
    const members: string[] = [];

    if (gtypeExpr !== undefined) {
        members.push(renderInterfaceHasInstance(context, className, gtypeExpr));
    }

    members.push(...renderStaticHead(context, callables, className));

    return renderBracedOrEmpty(`export abstract class ${className}`, members.join("\n\n"));
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
    const classExpression = renderBracedOrEmpty("class extends Base", members.join("\n\n"));

    return `export const ${makerName(className)}: Mixin = (Base) =>\n${classExpression};`;
};

const renderInterfaceInstanceMembers = (context: ModuleContext, iface: GirClass, callables: Callables): string[] => [
    ...renderInterfaceMembers(context, iface, callables, {
        renderMethod: renderClassInstanceMember,
        renderProperty: renderPropertyAccessor,
    }),
    ...renderSignalMembers(context, iface),
];

export { generateInterface };
