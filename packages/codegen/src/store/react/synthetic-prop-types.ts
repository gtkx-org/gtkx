import type { Call, CompanionRule, LayoutChildRule, SyntheticPropRule } from "@gtkx/config";
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

export type CompanionExportSpec = {
    element: string;
    typeName: string;
    typeSource: string;
    imports: TypeImports;
};

export type RuleTypegen = {
    classPropLines: (glibName: string, klass: GirClass, namespace: GirNamespace, imports: TypeImports) => string[];
    companionExports: (namespaceName: string) => CompanionExportSpec[];
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

export const createRuleTypegen = (library: Library, tables: RuleTables): RuleTypegen => {
    const typeIndex = new Map<string, TypeEntry>();
    for (const namespace of library.namespaces.values()) {
        for (const klass of [...namespace.classes, ...namespace.interfaces]) {
            const glibName = glibNameOf(klass);
            if (glibName !== undefined && !typeIndex.has(glibName)) typeIndex.set(glibName, { klass, namespace });
        }
    }

    const chainOf = (entry: TypeEntry): TypeEntry[] => {
        const chain: TypeEntry[] = [];
        for (const { klass, namespaceName } of ancestorChain(library, entry.klass, entry.namespace.name)) {
            const namespace = library.namespaces.get(namespaceName);
            if (namespace !== undefined) chain.push({ klass, namespace });
        }
        for (const iface of implementedInterfaces(entry.klass, entry.namespace, library)) {
            chain.push({ klass: iface.klass, namespace: iface.namespace });
        }
        return chain;
    };

    const findMethod = (typeName: string, camelName: string): ResolvedMethod | undefined => {
        const entry = typeIndex.get(typeName);
        if (entry === undefined) return undefined;
        for (const link of chainOf(entry)) {
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

    const hasProperty = (typeName: string, camelName: string): boolean => {
        const entry = typeIndex.get(typeName);
        if (entry === undefined) return false;
        return chainOf(entry).some((link) =>
            link.klass.properties.some((property) => toCamelIdentifier(property.name) === camelName),
        );
    };

    const renderParamType = (imports: TypeImports, param: GirParameter | undefined): string => {
        if (param === undefined) return "unknown";
        const base = renderBaseTypeFor(library, syntheticTarget(library, imports), param.type);
        return param.nullable || param.optional ? `${base} | null` : base;
    };

    const isWidgetParam = (param: GirParameter | undefined): boolean => {
        if (param?.type === undefined) return false;
        const resolved = library.typeOf(param.type);
        if (resolved === undefined || resolved.kind !== "class") return false;
        const glibName = glibNameOf(resolved.value);
        if (glibName === undefined) return false;
        const entry = typeIndex.get(glibName);
        if (entry === undefined) return false;
        return chainOf(entry).some((link) => glibNameOf(link.klass) === "GtkWidget");
    };

    const itemFieldLines = (imports: TypeImports, typeName: string, rule: SyntheticPropRule): string[] | null => {
        if (rule.kind !== "list" && rule.kind !== "keyed-list" && rule.kind !== "write-once-list") return null;
        const add = rule.add;
        if (typeof add === "string") return null;
        const method = findMethod(typeName, add.method);
        if (method === undefined) return null;
        const lines: string[] = [];
        add.args.forEach((arg, position) => {
            if (typeof arg !== "object" || !("field" in arg)) return;
            const param = method.params[position];
            const optional = "or" in arg || param?.nullable === true || param?.optional === true;
            lines.push(`${arg.field}${optional ? "?" : ""}: ${renderParamType(imports, param)};`);
        });
        if (rule.kind === "keyed-list" && rule.setters !== undefined) {
            for (const [field, setter] of Object.entries(rule.setters)) {
                const setterMethod = findMethod(typeName, setter);
                lines.push(`${field}?: ${renderParamType(imports, setterMethod?.params[1])};`);
            }
        }
        return lines;
    };

    const listItemType = (imports: TypeImports, typeName: string, rule: SyntheticPropRule): string => {
        const fieldLines = itemFieldLines(imports, typeName, rule);
        if (fieldLines !== null && fieldLines.length > 0) return `{ ${fieldLines.join(" ")} }`;
        if (rule.kind !== "list" && rule.kind !== "keyed-list" && rule.kind !== "write-once-list") return "unknown";
        const method = findMethod(typeName, callMethodName(rule.add));
        return renderParamType(imports, method?.params[0]);
    };

    const valueType = (imports: TypeImports, typeName: string, rule: SyntheticPropRule): string => {
        if (rule.kind !== "value") return "unknown";
        if (typeof rule.call !== "string") {
            const fieldLines: string[] = [];
            const method = findMethod(typeName, rule.call.method);
            rule.call.args.forEach((arg, position) => {
                if (typeof arg !== "object" || !("field" in arg)) return;
                const param = method?.params[position];
                const optional = "or" in arg || param?.nullable === true;
                fieldLines.push(`${arg.field}${optional ? "?" : ""}: ${renderParamType(imports, param)};`);
            });
            if (fieldLines.length > 0) return `{ ${fieldLines.join(" ")} }`;
        }
        const method = findMethod(typeName, callMethodName(rule.call));
        return renderParamType(imports, method?.params[0]);
    };

    const optionalLine = (prop: string, type: string): string => {
        const withNull = type.endsWith(" | null") ? type : `${type} | null`;
        return `${prop}?: ${withNull} | undefined;`;
    };

    const syntheticLine = (imports: TypeImports, rule: SyntheticPropRule): string | null => {
        if (hasProperty(rule.type, rule.prop)) return null;
        switch (rule.kind) {
            case "list":
            case "keyed-list":
            case "write-once-list":
                return optionalLine(rule.prop, `${listItemType(imports, rule.type, rule)}[]`);
            case "value":
                return optionalLine(rule.prop, valueType(imports, rule.type, rule));
            default:
                return null;
        }
    };

    const syntheticByType = new Map<string, SyntheticPropRule[]>();
    for (const rule of tables.syntheticProps) {
        const rules = syntheticByType.get(rule.type) ?? [];
        rules.push(rule);
        syntheticByType.set(rule.type, rules);
    }

    const propContributions: PropContribution[] = [];
    for (const rule of tables.relationships) {
        if (rule.kind !== "attach") continue;
        for (const call of [rule.add, rule.remove, rule.insert, rule.reorder]) {
            if (call === undefined || typeof call === "string") continue;
            const method = findMethod(rule.parent, call.method);
            call.args.forEach((arg, position) => {
                if (typeof arg !== "object" || !("prop" in arg)) return;
                const param = method?.params[position];
                if (param === undefined) return;
                if (hasProperty(rule.child, arg.prop)) return;
                if (propContributions.some((entry) => entry.child === rule.child && entry.prop === arg.prop)) return;
                propContributions.push({ child: rule.child, prop: arg.prop, param });
            });
        }
    }

    const directTypeNames = (klass: GirClass, namespace: GirNamespace): Set<string> => {
        const names = new Set<string>();
        const glibName = glibNameOf(klass);
        if (glibName !== undefined) names.add(glibName);
        for (const name of klass.implements) {
            const resolved = library.resolveType(namespace.name, name);
            if (resolved === undefined || resolved.kind !== "interface") continue;
            const ifaceGlib = glibNameOf(resolved.value);
            if (ifaceGlib !== undefined) names.add(ifaceGlib);
        }
        return names;
    };

    const classPropLines = (
        glibName: string,
        klass: GirClass,
        namespace: GirNamespace,
        imports: TypeImports,
    ): string[] => {
        const lines: string[] = [];
        for (const rule of syntheticByType.get(glibName) ?? []) {
            const line = syntheticLine(imports, rule);
            if (line !== null) lines.push(line);
        }
        const direct = directTypeNames(klass, namespace);
        for (const contribution of propContributions) {
            if (!direct.has(contribution.child)) continue;
            lines.push(optionalLine(contribution.prop, renderParamType(imports, contribution.param)));
        }
        return lines;
    };

    const companionClassOf = (rule: CompanionRule | LayoutChildRule): TypeEntry | undefined => {
        if (rule.kind === "layout-child") return typeIndex.get(`${rule.layout}Child`);
        return typeIndex.get(rule.element);
    };

    const constructOnlyNames = (entry: TypeEntry): string[] => {
        const names: string[] = [];
        for (const link of chainOf(entry)) {
            for (const property of link.klass.properties) {
                if (property.constructOnly) names.push(toCamelIdentifier(property.name));
            }
        }
        return names;
    };

    const propertyType = (imports: TypeImports, entry: TypeEntry, camelName: string): string => {
        for (const link of chainOf(entry)) {
            const property = link.klass.properties.find((candidate) => toCamelIdentifier(candidate.name) === camelName);
            if (property !== undefined) {
                return renderBaseTypeFor(library, syntheticTarget(library, imports), property.type);
            }
        }
        return "unknown";
    };

    const companionExportOf = (rule: CompanionRule | LayoutChildRule): CompanionExportSpec | undefined => {
        const parent = typeIndex.get(rule.parent);
        if (parent === undefined) return undefined;
        const imports: TypeImports = new Map();
        const companionClass = companionClassOf(rule);
        const setters = rule.kind === "companion" ? (rule.setters ?? {}) : {};
        const aliases = rule.kind === "companion" ? (rule.aliases ?? {}) : {};
        const extraLines: string[] = [];
        for (const [from, to] of Object.entries(aliases)) {
            const type = companionClass === undefined ? "unknown" : propertyType(imports, companionClass, to);
            extraLines.push(optionalLine(from, type));
        }
        for (const [prop, method] of Object.entries(setters)) {
            const resolved = findMethod(rule.parent, method);
            const param = resolved?.params[1];
            const type = isWidgetParam(param) ? "ReactNode" : renderParamType(imports, param);
            extraLines.push(optionalLine(prop, type));
        }
        const typeName = `${rule.element}ElementProps`;
        const extras = extraLines.length === 0 ? "" : ` & { ${extraLines.join(" ")} }`;
        let typeSource: string;
        if (companionClass === undefined) {
            typeSource = `export type ${typeName} = { children?: ReactNode }${extras};`;
        } else {
            const baseName = glibNameOf(companionClass.klass) ?? rule.element;
            const omitted = [...new Set([...constructOnlyNames(companionClass), ...Object.values(aliases)])];
            const omitUnion = omitted.map((name) => JSON.stringify(name)).join(" | ");
            const base = omitted.length === 0 ? `${baseName}Props` : `Omit<${baseName}Props, ${omitUnion}>`;
            typeSource = `export type ${typeName} = ${base}${extras};`;
        }
        return {
            element: rule.element,
            typeName,
            typeSource,
            imports,
        };
    };

    const companionSpecs = new Map<string, CompanionExportSpec[]>();
    for (const rule of tables.relationships) {
        if (rule.kind !== "companion" && rule.kind !== "layout-child") continue;
        const parent = typeIndex.get(rule.parent);
        if (parent === undefined) continue;
        const spec = companionExportOf(rule);
        if (spec === undefined) continue;
        const specs = companionSpecs.get(parent.namespace.name) ?? [];
        if (!specs.some((existing) => existing.element === spec.element)) specs.push(spec);
        companionSpecs.set(parent.namespace.name, specs);
    }

    return {
        classPropLines,
        companionExports: (namespaceName) => companionSpecs.get(namespaceName) ?? [],
    };
};
