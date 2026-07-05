import type { Call, CompanionRule, SyntheticPropRule } from "@gtkx/config";
import { toCamelIdentifier } from "@gtkx/utils";
import { renderBaseTypeFor, type TsTypeTarget } from "../../analysis/ts-type.js";
import { ancestorChain } from "../../gir/ancestry.js";
import type { GirClass } from "../../gir/class.js";
import type { GirFunction } from "../../gir/function.js";
import type { Library } from "../../gir/library.js";
import type { GirNamespace } from "../../gir/namespace.js";
import type { GirParameter } from "../../gir/parameter.js";
import { glibNameOf, implementedInterfaces } from "./intrinsic-elements.js";
import type { RuleTables } from "./rule-tables.js";

type TypeImports = Map<string, string>;

type TypeEntry = {
    klass: GirClass;
    namespace: GirNamespace;
};

type ResolvedMethod = {
    fn: GirFunction;
    params: GirParameter[];
};

type PropContribution = {
    child: string;
    prop: string;
    param: GirParameter;
};

type TypegenContext = {
    library: Library;
    typeIndex: Map<string, TypeEntry>;
};

export type CompanionExportSpec = {
    element: string;
    typeName: string;
    typeSource: string;
    imports: TypeImports;
};

export type RuleTypegen = {
    classPropLines: (glibName: string, klass: GirClass, namespace: GirNamespace, imports: TypeImports) => string[];
    companionExports: (namespaceName: string) => CompanionExportSpec[];
    slotNamesFor: (glibName: string) => string[];
};

const syntheticTarget = (library: Library, imports: TypeImports): TsTypeTarget => ({
    containerStyle: "record",
    callbackType: "(...args: unknown[]) => unknown",
    byteArrayAsNumber: false,
    renderNamed: (resolved, name) => {
        if (resolved?.kind === "alias") {
            return resolved.value.target === undefined
                ? "number"
                : renderBaseTypeFor(library, syntheticTarget(library, imports), resolved.value.target);
        }
        imports.set(name.namespaceName, name.namespaceName);
        return `${name.namespaceName}.${name.typeName}`;
    },
    renderGtype: () => {
        imports.set("GObject", "GObject");
        return "GObject.Type";
    },
});

const callMethodName = (call: Call): string => (typeof call === "string" ? call : call.method);

const buildTypeIndex = (library: Library): Map<string, TypeEntry> => {
    const typeIndex = new Map<string, TypeEntry>();
    for (const namespace of library.namespaces.values()) {
        for (const klass of [...namespace.classes, ...namespace.interfaces]) {
            const glibName = glibNameOf(klass);
            if (glibName !== undefined && !typeIndex.has(glibName)) typeIndex.set(glibName, { klass, namespace });
        }
    }
    return typeIndex;
};

const chainOf = (context: TypegenContext, entry: TypeEntry): TypeEntry[] => {
    const chain: TypeEntry[] = [];
    for (const { klass, namespaceName } of ancestorChain(context.library, entry.klass, entry.namespace.name)) {
        const namespace = context.library.namespaces.get(namespaceName);
        if (namespace !== undefined) chain.push({ klass, namespace });
    }
    for (const iface of implementedInterfaces(entry.klass, entry.namespace, context.library)) {
        chain.push({ klass: iface.klass, namespace: iface.namespace });
    }
    return chain;
};

const findMethod = (context: TypegenContext, typeName: string, camelName: string): ResolvedMethod | undefined => {
    const entry = context.typeIndex.get(typeName);
    if (entry === undefined) return undefined;
    for (const link of chainOf(context, entry)) {
        const fn = link.klass.methods.find(
            (method) =>
                method.introspectable &&
                method.shadowedBy === undefined &&
                toCamelIdentifier(method.name) === camelName,
        );
        if (fn !== undefined) {
            return { fn, params: fn.parameters.filter((param) => param.direction === "in") };
        }
    }
    return undefined;
};

const hasProperty = (context: TypegenContext, typeName: string, camelName: string): boolean => {
    const entry = context.typeIndex.get(typeName);
    if (entry === undefined) return false;
    return chainOf(context, entry).some((link) =>
        link.klass.properties.some((property) => toCamelIdentifier(property.name) === camelName),
    );
};

const renderParamType = (context: TypegenContext, imports: TypeImports, param: GirParameter | undefined): string => {
    if (param === undefined) return "unknown";
    const base = renderBaseTypeFor(context.library, syntheticTarget(context.library, imports), param.type);
    return param.nullable || param.optional ? `${base} | null` : base;
};

const isWidgetParam = (context: TypegenContext, param: GirParameter | undefined): boolean => {
    if (param?.type === undefined) return false;
    const resolved = context.library.typeOf(param.type);
    if (resolved === undefined || resolved.kind !== "class") return false;
    const glibName = glibNameOf(resolved.value);
    if (glibName === undefined) return false;
    const entry = context.typeIndex.get(glibName);
    if (entry === undefined) return false;
    return chainOf(context, entry).some((link) => glibNameOf(link.klass) === "GtkWidget");
};

const optionalLine = (prop: string, type: string): string => {
    const withNull = type.endsWith(" | null") ? type : `${type} | null`;
    return `${prop}?: ${withNull} | undefined;`;
};

type ListLikeRule = Extract<SyntheticPropRule, { kind: "list" | "keyed-list" | "write-once-list" }>;

const itemFieldLines = (context: TypegenContext, imports: TypeImports, rule: ListLikeRule): string[] => {
    const lines: string[] = [];
    if (typeof rule.add !== "string") {
        const method = findMethod(context, rule.type, rule.add.method);
        rule.add.args.forEach((arg, positionIndex) => {
            if (typeof arg !== "object" || !("field" in arg)) return;
            const param = method?.params[positionIndex];
            const optional = "or" in arg || param?.nullable === true || param?.optional === true;
            lines.push(`${arg.field}${optional ? "?" : ""}: ${renderParamType(context, imports, param)};`);
        });
    }
    if (rule.kind === "keyed-list" && rule.setters !== undefined) {
        for (const [field, setter] of Object.entries(rule.setters)) {
            const setterMethod = findMethod(context, rule.type, setter);
            lines.push(`${field}?: ${renderParamType(context, imports, setterMethod?.params[1])};`);
        }
    }
    return lines;
};

const listItemType = (context: TypegenContext, imports: TypeImports, rule: ListLikeRule): string => {
    const fieldLines = itemFieldLines(context, imports, rule);
    if (fieldLines.length > 0) return `{ ${fieldLines.join(" ")} }`;
    const method = findMethod(context, rule.type, callMethodName(rule.add));
    return renderParamType(context, imports, method?.params[0]);
};

const valueType = (
    context: TypegenContext,
    imports: TypeImports,
    rule: Extract<SyntheticPropRule, { kind: "value" }>,
): string => {
    if (typeof rule.call !== "string") {
        const fieldLines: string[] = [];
        const method = findMethod(context, rule.type, rule.call.method);
        rule.call.args.forEach((arg, positionIndex) => {
            if (typeof arg !== "object" || !("field" in arg)) return;
            const param = method?.params[positionIndex];
            const optional = "or" in arg || param?.nullable === true;
            fieldLines.push(`${arg.field}${optional ? "?" : ""}: ${renderParamType(context, imports, param)};`);
        });
        if (fieldLines.length > 0) return `{ ${fieldLines.join(" ")} }`;
    }
    const method = findMethod(context, rule.type, callMethodName(rule.call));
    return renderParamType(context, imports, method?.params[0]);
};

const syntheticLine = (context: TypegenContext, imports: TypeImports, rule: SyntheticPropRule): string | null => {
    if (hasProperty(context, rule.type, rule.prop)) return null;
    switch (rule.kind) {
        case "list":
        case "keyed-list":
        case "write-once-list":
            return optionalLine(rule.prop, `${listItemType(context, imports, rule)}[]`);
        case "value":
            return optionalLine(rule.prop, valueType(context, imports, rule));
        default:
            return null;
    }
};

const collectPropContributions = (context: TypegenContext, tables: RuleTables): PropContribution[] => {
    const contributions: PropContribution[] = [];
    for (const rule of tables.relationships) {
        if (rule.kind !== "attach") continue;
        for (const call of [rule.add, rule.remove, rule.insert, rule.reorder]) {
            if (call === undefined || typeof call === "string") continue;
            collectCallContributions(context, contributions, rule, call);
        }
    }
    return contributions;
};

const collectCallContributions = (
    context: TypegenContext,
    contributions: PropContribution[],
    rule: { parent: string; child: string },
    call: Exclude<Call, string>,
): void => {
    const method = findMethod(context, rule.parent, call.method);
    call.args.forEach((arg, positionIndex) => {
        if (typeof arg !== "object" || !("prop" in arg)) return;
        const param = method?.params[positionIndex];
        if (param === undefined) return;
        if (hasProperty(context, rule.child, arg.prop)) return;
        if (contributions.some((entry) => entry.child === rule.child && entry.prop === arg.prop)) return;
        contributions.push({ child: rule.child, prop: arg.prop, param });
    });
};

const directTypeNames = (context: TypegenContext, klass: GirClass, namespace: GirNamespace): Set<string> => {
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

const companionClassOf = (context: TypegenContext, rule: CompanionRule): TypeEntry | undefined =>
    context.typeIndex.get(rule.element);

const constructOnlyNames = (context: TypegenContext, entry: TypeEntry): string[] => {
    const names: string[] = [];
    for (const link of chainOf(context, entry)) {
        for (const property of link.klass.properties) {
            if (property.constructOnly) names.push(toCamelIdentifier(property.name));
        }
    }
    return names;
};

const companionExtraLines = (context: TypegenContext, imports: TypeImports, rule: CompanionRule): string[] => {
    const setters = rule.setters ?? {};
    const extraLines: string[] = [];
    for (const [prop, method] of Object.entries(setters)) {
        const resolved = findMethod(context, rule.parent, method);
        const param = resolved?.params[1];
        const type = isWidgetParam(context, param) ? "ReactNode" : renderParamType(context, imports, param);
        extraLines.push(optionalLine(prop, type));
    }
    return extraLines;
};

const companionExportOf = (context: TypegenContext, rule: CompanionRule): CompanionExportSpec | undefined => {
    if (!context.typeIndex.has(rule.parent)) return undefined;
    const imports: TypeImports = new Map();
    const companionClass = companionClassOf(context, rule);
    const extraLines = companionExtraLines(context, imports, rule);
    const typeName = `${rule.element}ElementProps`;
    const extras = extraLines.length === 0 ? "" : ` & { ${extraLines.join(" ")} }`;
    let typeSource: string;
    if (companionClass === undefined) {
        typeSource = `export type ${typeName} = { children?: ReactNode }${extras};`;
    } else {
        const baseName = glibNameOf(companionClass.klass) ?? rule.element;
        const setterNames = Object.keys(rule.setters ?? {});
        const omitted = [...new Set([...constructOnlyNames(context, companionClass), ...setterNames])];
        const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
        const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;
        typeSource = `export type ${typeName} = ${base}${extras};`;
    }
    return { element: rule.element, typeName, typeSource, imports };
};

const collectCompanionSpecs = (context: TypegenContext, tables: RuleTables): Map<string, CompanionExportSpec[]> => {
    const companionSpecs = new Map<string, CompanionExportSpec[]>();
    for (const rule of tables.relationships) {
        if (rule.kind !== "companion") continue;
        const parent = context.typeIndex.get(rule.parent);
        if (parent === undefined) continue;
        const spec = companionExportOf(context, rule);
        if (spec === undefined) continue;
        const specs = companionSpecs.get(parent.namespace.name) ?? [];
        if (!specs.some((existing) => existing.element === spec.element)) specs.push(spec);
        companionSpecs.set(parent.namespace.name, specs);
    }
    return companionSpecs;
};

const collectSlotNames = (tables: RuleTables): Map<string, string[]> => {
    const slotNamesByParent = new Map<string, string[]>();
    for (const rule of tables.relationships) {
        if (rule.kind !== "attach" || rule.slot === undefined) continue;
        const names = slotNamesByParent.get(rule.parent) ?? [];
        if (!names.includes(rule.slot)) names.push(rule.slot);
        slotNamesByParent.set(rule.parent, names);
    }
    return slotNamesByParent;
};

export const createRuleTypegen = (library: Library, tables: RuleTables): RuleTypegen => {
    const context: TypegenContext = { library, typeIndex: buildTypeIndex(library) };

    const syntheticByType = new Map<string, SyntheticPropRule[]>();
    for (const rule of tables.syntheticProps) {
        const rules = syntheticByType.get(rule.type) ?? [];
        rules.push(rule);
        syntheticByType.set(rule.type, rules);
    }

    const propContributions = collectPropContributions(context, tables);
    const companionSpecs = collectCompanionSpecs(context, tables);
    const slotNamesByParent = collectSlotNames(tables);

    const classPropLines = (
        glibName: string,
        klass: GirClass,
        namespace: GirNamespace,
        imports: TypeImports,
    ): string[] => {
        const lines: string[] = [];
        for (const rule of syntheticByType.get(glibName) ?? []) {
            const line = syntheticLine(context, imports, rule);
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
        companionExports: (namespaceName) => companionSpecs.get(namespaceName) ?? [],
        slotNamesFor: (glibName) => slotNamesByParent.get(glibName) ?? [],
    };
};
