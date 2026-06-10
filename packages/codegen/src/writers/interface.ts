import { toPascalCase } from "@gtkx/utils";
import type { ModuleContext } from "../dsl/context.js";
import { indent } from "../dsl/emit.js";
import type { GirClass } from "../gir/class.js";
import type { GirFunction } from "../gir/function.js";
import { qualifyFunction } from "../gir/qualify.js";
import {
    appendMethodBinding,
    type Callables,
    dedupeCallables,
    emitBindings,
    indexMethodsByName,
    renderInstanceMethod,
    renderPlainTypeMembers,
} from "./callables.js";
import { renderVfuncMetadata } from "./class-struct.js";
import { renderGetTypeReference } from "./gtype-binding.js";
import { resolveImplementedInterface, resolvePrerequisiteReference } from "./inheritance.js";
import { methodExportName } from "./method.js";
import { renderPropertyAccessor } from "./property-accessor.js";
import { appendNativeClassRegistration } from "./registration.js";
import { renderSignalDeclarations, renderSignalMembers } from "./signal.js";

/**
 * Emits a class declaration for a `<interface>` element.
 *
 * Interfaces have no GIR parent — they extend the GObject base
 * (`GObject.Object`) in the generated output because every implementor is
 * itself a GObject. Methods, static functions, and constructors are
 * surfaced on the interface class just like a regular class so JS callers
 * can dispatch them directly on interface-typed values.
 *
 * @param context - The module context
 * @param iface - The interface to emit
 */
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

    const parent = resolveInterfaceParent(context);
    const members = renderInterfaceMembers(context, iface, callables);
    const body = members.map((member) => indent(member, 1)).join("\n\n");
    context.module.appendDeclaration(`export class ${className} extends ${parent} {\n${body}\n}`);

    const prerequisiteRefs = iface.prerequisites
        .map((name) => resolvePrerequisiteReference(context, name))
        .filter((entry): entry is string => entry !== undefined);
    if (prerequisiteRefs.length > 0) {
        context.module.appendDeclaration(`export interface ${className} extends ${prerequisiteRefs.join(", ")} {}`);
    }
    for (const declaration of renderSignalDeclarations(context, iface, className, true)) {
        context.module.appendDeclaration(declaration);
    }

    appendInterfaceRegistrations(context, iface, className);
};

const renderInterfaceMembers = (context: ModuleContext, iface: GirClass, callables: Callables): readonly string[] => {
    const className = toPascalCase(iface.name);
    const { members, claimedNames } = renderPlainTypeMembers({
        context,
        className,
        callables,
        hasGType: true,
        wrap: "interface",
    });
    appendPrerequisiteMethods(context, iface, members, claimedNames);
    const methodByName = indexMethodsByName(callables.methods);
    for (const property of iface.properties) {
        const block = renderPropertyAccessor(context, property, claimedNames, methodByName);
        if (block !== undefined) members.push(block);
    }
    members.push(...renderSignalMembers(context, iface));
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
 * @param context - The module context
 * @param iface - The interface being emitted
 * @param members - The accumulating member list
 * @param claimedNames - Names already emitted on the interface body
 */
const appendPrerequisiteMethods = (
    context: ModuleContext,
    iface: GirClass,
    members: string[],
    claimedNames: Set<string>,
): void => {
    for (const method of collectPrerequisiteMethods(context, iface)) {
        const name = methodExportName(method);
        if (name === "constructor" || claimedNames.has(name)) continue;
        const block = renderInstanceMethod(context, method);
        if (block === undefined) continue;
        appendMethodBinding(context, method);
        members.push(block);
        claimedNames.add(name);
    }
};

const collectPrerequisiteMethods = (context: ModuleContext, iface: GirClass): readonly GirFunction[] => {
    const result: GirFunction[] = [];
    const visited = new Set<string>();
    const seen = new Set<string>();
    for (const method of iface.methods) {
        if (method.introspectable) seen.add(methodExportName(method));
    }
    const visit = (klass: GirClass, namespaceName: string): void => {
        for (const prerequisiteName of klass.prerequisites) {
            const prerequisite = resolveImplementedInterface(context, prerequisiteName, namespaceName);
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
    visit(iface, context.namespace.name);
    return result;
};

const appendInterfaceRegistrations = (context: ModuleContext, iface: GirClass, className: string): void => {
    const getTypeRef =
        iface.glibGetType === undefined
            ? undefined
            : renderGetTypeReference(context, iface.glibGetType, iface.glibTypeName);
    appendNativeClassRegistration(context, {
        className,
        role: "interface",
        getTypeRef,
        vfuncs: renderVfuncMetadata(context, iface),
    });
};

const resolveInterfaceParent = (context: ModuleContext): string => {
    if (context.namespace.name === "GObject") return "Object";
    const alias = context.addCrossNamespaceImport("GObject");
    return `${alias}.Object`;
};
