import type { AppliedProp, ContainerProp, ElementProp, ListProp, ValueProp } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { renderBaseTypeFor, type TsTypeTarget } from "../../analysis/ts-type.js";
import type { GirClass } from "../../gir/class.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirParameter } from "../../gir/parameter.js";
import { buildGirIndex, chainOf, findMethod, type GirIndex, type GirTypeEntry, hasProperty } from "./gir-index.js";
import { glibNameOf } from "./intrinsic-elements.js";

type TypeImports = Map<string, string>;

type PropContribution = {
    child: string;
    prop: string;
    param: GirParameter;
};

export type LazyElementSpec = {
    element: string;
    typeName: string;
    typeSource: string;
};

export type ElementPropTypegen = {
    classPropLines: (glibName: string, klass: GirClass, namespace: GirNamespace, imports: TypeImports) => string[];
    lazyElementExports: (namespaceName: string) => LazyElementSpec[];
    slotNamesFor: (glibName: string) => string[];
    acceptsChildren: (glibName: string) => boolean;
};

const elementPropTarget = (library: Library, imports: TypeImports): TsTypeTarget => ({
    containerStyle: "record",
    callbackType: "(...args: unknown[]) => unknown",
    byteArrayAsNumber: false,
    renderNamed: (resolved, name) => {
        if (resolved?.kind === "alias") {
            return resolved.value.target === undefined
                ? "number"
                : renderBaseTypeFor(library, elementPropTarget(library, imports), resolved.value.target);
        }
        imports.set(name.namespaceName, name.namespaceName);
        return `${name.namespaceName}.${name.typeName}`;
    },
    renderGtype: () => {
        imports.set("GObject", "GObject");
        return "GObject.Type";
    },
});

const forEachContainer = (
    elementProps: Record<string, ElementProp[]>,
    visit: (type: string, prop: ContainerProp) => void,
): void => {
    for (const [type, props] of Object.entries(elementProps)) {
        for (const prop of props) {
            if (prop.kind === "container") visit(type, prop);
        }
    }
};

const renderParamType = (context: GirIndex, imports: TypeImports, param: GirParameter | undefined): string => {
    if (param === undefined) return "unknown";
    const base = renderBaseTypeFor(context.library, elementPropTarget(context.library, imports), param.type);
    return param.nullable || param.optional ? `${base} | null` : base;
};

const optionalLine = (prop: string, type: string): string => {
    const withNull = type.endsWith(" | null") ? type : `${type} | null`;
    return `${prop}?: ${withNull} | undefined;`;
};

const valueType = (context: GirIndex, imports: TypeImports, type: string, prop: ValueProp): string => {
    if (typeof prop.call !== "string") {
        const fieldLines: string[] = [];
        const method = findMethod(context, type, prop.call.method);
        prop.call.args.forEach((arg, positionIndex) => {
            if (typeof arg !== "object" || !("field" in arg)) return;
            const param = method?.params[positionIndex];
            const optional = "or" in arg || param?.nullable === true;
            fieldLines.push(`${arg.field}${optional ? "?" : ""}: ${renderParamType(context, imports, param)};`);
        });
        if (fieldLines.length > 0) return `{ ${fieldLines.join(" ")} }`;
        return renderParamType(context, imports, method?.params[0]);
    }
    const method = findMethod(context, type, prop.call);
    return renderParamType(context, imports, method?.params[0]);
};

const listItemType = (context: GirIndex, imports: TypeImports, type: string, prop: ListProp): string => {
    if (typeof prop.add === "string") {
        const method = findMethod(context, type, prop.add);
        return renderParamType(context, imports, method?.params[0]);
    }
    const method = findMethod(context, type, prop.add.method);
    const fieldLines: string[] = [];
    prop.add.args.forEach((arg, index) => {
        if (typeof arg !== "object" || !("field" in arg)) return;
        const param = method?.params[index];
        const optional = param?.nullable === true || param?.optional === true;
        fieldLines.push(`${arg.field}${optional ? "?" : ""}: ${renderParamType(context, imports, param)};`);
    });
    if (fieldLines.length > 0) return `{ ${fieldLines.join(" ")} }`;
    return renderParamType(context, imports, method?.params[0]);
};

const appliedPropLine = (context: GirIndex, imports: TypeImports, type: string, prop: AppliedProp): string | null => {
    if (hasProperty(context, type, prop.prop)) return null;
    if (prop.kind === "value") return optionalLine(prop.prop, valueType(context, imports, type, prop));
    if (prop.kind === "list") return optionalLine(prop.prop, `${listItemType(context, imports, type, prop)}[]`);
    return null;
};

const collectCallContributions = (
    context: GirIndex,
    contributions: PropContribution[],
    slot: { parent: string; child: string },
    call: Exclude<ContainerProp["append"], string | undefined>,
): void => {
    const method = findMethod(context, slot.parent, call.method);
    call.args.forEach((arg, positionIndex) => {
        if (typeof arg !== "object" || !("prop" in arg)) return;
        const param = method?.params[positionIndex];
        if (param === undefined) return;
        if (hasProperty(context, slot.child, arg.prop)) return;
        if (contributions.some((entry) => entry.child === slot.child && entry.prop === arg.prop)) return;
        contributions.push({ child: slot.child, prop: arg.prop, param });
    });
};

const collectPropContributions = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): PropContribution[] => {
    const contributions: PropContribution[] = [];
    forEachContainer(elementProps, (parent, cp) => {
        for (const call of [cp.append, cp.remove, cp.insert, cp.reorder]) {
            if (call === undefined || typeof call === "string") continue;
            collectCallContributions(context, contributions, { parent, child: cp.child }, call);
        }
    });
    return contributions;
};

const directTypeNames = (context: GirIndex, klass: GirClass, namespace: GirNamespace): Set<string> => {
    const names = new Set<string>();
    const glibName = glibNameOf(klass);
    if (glibName !== undefined) names.add(glibName);
    for (const name of klass.implements) {
        const resolved = context.library.resolveType(namespace.name, name);
        if (resolved === undefined || resolved.kind !== "interface") continue;
        const ifaceGlib = glibNameOf(resolved.value);
        if (ifaceGlib !== undefined) names.add(ifaceGlib);
    }
    return names;
};

const constructOnlyNames = (context: GirIndex, entry: GirTypeEntry): string[] => {
    const names: string[] = [];
    for (const klass of chainOf(context, entry)) {
        for (const property of klass.properties) {
            if (property.constructOnly) names.push(toCamelIdentifier(property.name));
        }
    }
    return names;
};

const methodReturnGlib = (context: GirIndex, typeName: string, methodCamel: string): string | undefined => {
    const method = findMethod(context, typeName, methodCamel);
    const ref = method?.fn.returnValue.type;
    if (ref === undefined) return undefined;
    const resolved = context.library.typeOf(ref);
    if (resolved === undefined || resolved.kind !== "class") return undefined;
    return glibNameOf(resolved.value);
};

const resolveAdoptElement = (context: GirIndex, parent: string, cp: ContainerProp): string | undefined => {
    if (cp.adopt === undefined) return undefined;
    const source = typeof cp.adopt === "string" ? cp.adopt : cp.append;
    if (source === undefined) return undefined;
    const method = typeof source === "string" ? source : source.method;
    return methodReturnGlib(context, parent, method);
};

const lazyElementExportOf = (context: GirIndex, element: string): LazyElementSpec => {
    const typeName = `${element}ElementProps`;
    const elementClass = context.index.get(element);
    if (elementClass === undefined) {
        return { element, typeName, typeSource: `export type ${typeName} = { children?: ReactNode };` };
    }
    const baseName = glibNameOf(elementClass.klass) ?? element;
    const omitted = constructOnlyNames(context, elementClass);
    const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
    const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;
    return { element, typeName, typeSource: `export type ${typeName} = ${base};` };
};

const collectLazyElementSpecs = (
    context: GirIndex,
    elementProps: Record<string, ElementProp[]>,
): Map<string, LazyElementSpec[]> => {
    const specs = new Map<string, LazyElementSpec[]>();
    forEachContainer(elementProps, (parent, cp) => {
        const parentEntry = context.index.get(parent);
        if (parentEntry === undefined) return;
        const element = resolveAdoptElement(context, parent, cp);
        if (element === undefined) return;
        const spec = lazyElementExportOf(context, element);
        const list = specs.get(parentEntry.namespace.name) ?? [];
        if (!list.some((existing) => existing.element === spec.element)) list.push(spec);
        specs.set(parentEntry.namespace.name, list);
    });
    return specs;
};

const collectSlotNames = (elementProps: Record<string, ElementProp[]>): Map<string, string[]> => {
    const slotNamesByParent = new Map<string, string[]>();
    forEachContainer(elementProps, (parent, cp) => {
        if (cp.prop === "children") return;
        const names = slotNamesByParent.get(parent) ?? [];
        if (!names.includes(cp.prop)) names.push(cp.prop);
        slotNamesByParent.set(parent, names);
    });
    return slotNamesByParent;
};

export const createElementPropTypegen = (
    library: Library,
    elementProps: Record<string, ElementProp[]>,
): ElementPropTypegen => {
    const context = buildGirIndex(library);

    const appliedByType = new Map<string, AppliedProp[]>();
    for (const [type, props] of Object.entries(elementProps)) {
        for (const prop of props) {
            if (prop.kind === "container") continue;
            const list = appliedByType.get(type) ?? [];
            list.push(prop);
            appliedByType.set(type, list);
        }
    }

    const propContributions = collectPropContributions(context, elementProps);
    const lazyElementSpecs = collectLazyElementSpecs(context, elementProps);
    const slotNamesByParent = collectSlotNames(elementProps);

    const childrenContainers = new Set<string>(["GtkLabel", "GtkTextBuffer", "GtkTextTag", "GtkTextView"]);
    forEachContainer(elementProps, (parent, cp) => {
        if (cp.prop === "children") childrenContainers.add(parent);
        const element = resolveAdoptElement(context, parent, cp);
        if (element !== undefined) childrenContainers.add(element);
    });

    const acceptsChildren = (glibName: string): boolean => {
        if (childrenContainers.has(glibName)) return true;
        const entry = context.index.get(glibName);
        if (entry === undefined) return false;
        return chainOf(context, entry).some((klass) => {
            const name = glibNameOf(klass);
            return name !== undefined && childrenContainers.has(name);
        });
    };

    const classPropLines = (
        glibName: string,
        klass: GirClass,
        namespace: GirNamespace,
        imports: TypeImports,
    ): string[] => {
        const lines: string[] = [];
        for (const prop of appliedByType.get(glibName) ?? []) {
            const line = appliedPropLine(context, imports, glibName, prop);
            if (line !== null) lines.push(line);
        }
        const direct = directTypeNames(context, klass, namespace);
        for (const contribution of propContributions) {
            if (!direct.has(contribution.child)) continue;
            lines.push(optionalLine(contribution.prop, renderParamType(context, imports, contribution.param)));
        }
        return lines;
    };

    return {
        classPropLines,
        lazyElementExports: (namespaceName) => lazyElementSpecs.get(namespaceName) ?? [],
        slotNamesFor: (glibName) => slotNamesByParent.get(glibName) ?? [],
        acceptsChildren,
    };
};
