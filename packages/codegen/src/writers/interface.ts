import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import { pascalCase } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import { splitQualifiedName } from "../gir/qualified-name.js";
import { qualifyFunction } from "../gir/qualify.js";
import {
    appendMethodBinding,
    buildPlainTypeMembers,
    type Callables,
    dedupeCallables,
    emitBindings,
    renderInstanceMethod,
} from "./callables.js";
import { renderVFuncMeta } from "./class-struct.js";
import { renderGetTypeReference } from "./gtype-binding.js";
import { resolveImplementedInterface } from "./inheritance.js";
import { methodExportName } from "./method.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { appendNativeClassRegistration } from "./registration.js";
import { renderSignalMembers, renderSignalRegistration } from "./signal.js";

/**
 * Emits a class declaration for a `<interface>` element.
 *
 * Interfaces have no GIR parent — they extend the GObject base
 * (`GObject.Object`) in the generated output because every implementor is
 * itself a GObject. Methods, static functions, and constructors are
 * surfaced on the interface class just like a regular class so JS callers
 * can dispatch them directly on interface-typed values.
 *
 * @param ctx - The module context
 * @param iface - The interface to emit
 */
export const emitInterface = (ctx: ModuleContext, iface: GirClass): void => {
    if (!iface.introspectable) return;
    if (iface.name.length === 0) return;
    const className = pascalCase(iface.name);
    const callables: Callables = {
        constructors: dedupeCallables(iface.constructors),
        functions: dedupeCallables(iface.functions),
        methods: dedupeCallables(iface.methods),
    };
    emitBindings(ctx, callables);

    const parent = resolveInterfaceParent(ctx);
    const members = buildInterfaceMembers(ctx, iface, callables);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    ctx.module.appendDeclaration(`export class ${className} extends ${parent} {\n${body}\n}`);

    const prerequisiteRefs = iface.prerequisites
        .map((name) => resolvePrerequisiteReference(ctx, name))
        .filter((entry): entry is string => entry !== undefined);
    if (prerequisiteRefs.length > 0) {
        ctx.module.appendDeclaration(`export interface ${className} extends ${prerequisiteRefs.join(", ")} {}`);
    }

    appendInterfaceRegistrations(ctx, iface, className);
};

const buildInterfaceMembers = (ctx: ModuleContext, iface: GirClass, callables: Callables): readonly string[] => {
    const className = pascalCase(iface.name);
    const { members, claimedNames } = buildPlainTypeMembers({
        ctx,
        className,
        callables,
        hasGType: true,
    });
    appendPrerequisiteMethods(ctx, iface, members, claimedNames);
    for (const property of iface.properties) {
        const block = renderPropertyAccessor(ctx, property, claimedNames);
        if (block !== undefined) members.push(block);
    }
    members.push(...renderSignalMembers(ctx, iface));
    return members;
};

/**
 * Copies the methods of an interface's transitive prerequisite interfaces onto
 * the interface wrapper class.
 *
 * A `Gtk.SelectionModel` value is also a `Gio.ListModel`, but the JS wrapper
 * only exposes `getNItems`/`getItem` if those prerequisite methods are emitted
 * on the wrapper. Each prerequisite interface's methods are re-rooted to its
 * namespace, bound, and emitted as direct members; names already provided by
 * the interface itself are skipped.
 *
 * @param ctx - The module context
 * @param iface - The interface being emitted
 * @param members - The accumulating member list
 * @param claimedNames - Names already emitted on the interface body
 */
const appendPrerequisiteMethods = (
    ctx: ModuleContext,
    iface: GirClass,
    members: string[],
    claimedNames: Set<string>,
): void => {
    for (const method of collectPrerequisiteMethods(ctx, iface)) {
        const name = methodExportName(method);
        if (name === "constructor" || claimedNames.has(name)) continue;
        const block = renderInstanceMethod(ctx, method);
        if (block === undefined) continue;
        appendMethodBinding(ctx, method);
        members.push(block);
        claimedNames.add(name);
    }
};

const collectPrerequisiteMethods = (ctx: ModuleContext, iface: GirClass): readonly GirFunction[] => {
    const result: GirFunction[] = [];
    const visited = new Set<string>();
    const seen = new Set<string>();
    for (const method of iface.methods) {
        if (method.introspectable) seen.add(methodExportName(method));
    }
    const visit = (klass: GirClass, namespaceName: string): void => {
        for (const prerequisiteName of klass.prerequisites) {
            const prerequisite = resolveImplementedInterface(ctx, prerequisiteName, namespaceName);
            if (prerequisite === undefined) continue;
            const key = `${prerequisite.namespaceName}.${prerequisite.klass.name}`;
            if (visited.has(key)) continue;
            visited.add(key);
            for (const method of dedupeCallables(prerequisite.klass.methods)) {
                const name = methodExportName(method);
                if (seen.has(name)) continue;
                seen.add(name);
                result.push(qualifyFunction(method, prerequisite.namespaceName));
            }
            visit(prerequisite.klass, prerequisite.namespaceName);
        }
    };
    visit(iface, ctx.namespace.name);
    return result;
};

const appendInterfaceRegistrations = (ctx: ModuleContext, iface: GirClass, className: string): void => {
    const getTypeRef =
        iface.glibGetType === undefined
            ? undefined
            : renderGetTypeReference(ctx, iface.glibGetType, iface.glibTypeName);
    appendNativeClassRegistration(ctx, {
        className,
        role: "interface",
        getTypeRef,
        vfuncs: renderVFuncMeta(ctx, iface),
        signals: renderSignalRegistration(ctx, iface),
    });
};

const resolveInterfaceParent = (ctx: ModuleContext): string => {
    if (ctx.namespace.name === "GObject") return "Object";
    const alias = ctx.addCrossNamespaceImport("GObject");
    return `${alias}.Object`;
};

const resolvePrerequisiteReference = (ctx: ModuleContext, name: string): string | undefined => {
    const { namespaceName, typeName } = splitQualifiedName(name, ctx.namespace.name);
    const resolved = ctx.repository.resolveNamed(namespaceName, typeName);
    if (resolved === undefined) return undefined;
    if (resolved.kind !== "interface" && resolved.kind !== "class") return undefined;
    if (namespaceName === ctx.namespace.name) return pascalCase(typeName);
    const alias = ctx.addCrossNamespaceImport(namespaceName);
    return `${alias}.${pascalCase(typeName)}`;
};
