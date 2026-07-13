import { sortStringsBy, toPascalCase } from "@gtkx/utils";
import { reservedSignalMemberRename } from "../analysis/inheritance.js";
import { renderTsType } from "../analysis/ts-type.js";
import { ancestorChain } from "../gir/ancestry.js";
import { callbackAsFunction, type GirCallback } from "../gir/callback.js";
import type { GirClass } from "../gir/class.js";
import type { GirEnum } from "../gir/enum.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import { type GirAlias, type GirConstant, type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { PRIMITIVE_TS_TYPE, primitiveCategory } from "../gir/primitives.js";
import type { GirProperty } from "../gir/property.js";
import type { GirRecord } from "../gir/record.js";
import {
    dedupeCallables,
    indexMethodsByName,
    renderInstanceMethodSignature,
    renderStaticSignature,
} from "../store/gi/callables.js";
import { constantLiteral } from "../store/gi/constant.js";
import { enumMemberKey } from "../store/gi/enum.js";
import { methodExportName, renderMethodReturnType, renderMethodSignature } from "../store/gi/method.js";
import { type ResolvedAccessor, resolveAccessor } from "../store/gi/property-accessor.js";
import { resolveRecordFieldEntry } from "../store/gi/record-field-accessor.js";
import { computeRecordFieldSlots } from "../store/gi/record-layout.js";
import { implementedInterfaces, newlyImplementedInterfaces } from "../store/react/intrinsic-elements.js";
import type { ModuleContext } from "../writer/context.js";
import {
    classMethodEntries,
    docMarkdown,
    docsDefaultValue,
    docsSignatureContext,
    firstSentence,
    joinSections,
    metaBlock,
    methodsSectionBlocks,
    originSignatureBlocks,
    renderDocsSignalHandlerType,
    renderDocsType,
    type SignatureEntry,
    signatureBlock,
} from "./render.js";

type GiSymbolBase = {
    namespace: GirNamespace;
    name: string;
    doc: string | undefined;
};

export type GiSymbolEntry =
    | (GiSymbolBase & { kind: "class" | "interface"; klass: GirClass })
    | (GiSymbolBase & { kind: "record"; record: GirRecord })
    | (GiSymbolBase & { kind: "enum"; enumeration: GirEnum })
    | (GiSymbolBase & { kind: "callback"; callback: GirCallback })
    | (GiSymbolBase & { kind: "alias"; alias: GirAlias })
    | (GiSymbolBase & { kind: "function"; fn: GirFunction })
    | (GiSymbolBase & { kind: "constant"; constant: GirConstant });

export type SymbolPageOptions = {
    library: Library;
    elementNameFor: (namespaceName: string, className: string) => string | undefined;
};

const qualifiedName = (entry: GiSymbolBase): string => `${entry.namespace.name}.${entry.name}`;

const frontmatter = (entry: GiSymbolBase, kindLabel: string): string => {
    const sentence = firstSentence(entry.doc);
    const description = sentence.length > 0 ? sentence : `API reference for the ${qualifiedName(entry)} ${kindLabel}.`;
    return `---\ndescription: ${JSON.stringify(description)}\n---`;
};

const kindLine = (kindLabel: string, namespace: GirNamespace): string =>
    `\`${kindLabel}\` in \`@gtkx/gi/${namespaceDirectory(namespace)}\``;

const importBlock = (entry: GiSymbolBase): string =>
    `\`\`\`ts\nimport * as ${entry.namespace.name} from "@gtkx/gi/${namespaceDirectory(entry.namespace)}";\n\`\`\``;

const pageHeader = (entry: GiSymbolEntry, kindLabel: string): string[] => [
    frontmatter(entry, kindLabel),
    `# ${qualifiedName(entry)}`,
    kindLine(kindLabel, entry.namespace),
    docMarkdown(entry.doc),
    importBlock(entry),
];

const qualifiedClassName = (namespaceName: string, className: string): string =>
    `${namespaceName}.${toPascalCase(className)}`;

const elementNote = (entry: GiSymbolBase & { klass: GirClass }, options: SymbolPageOptions): string[] => {
    const glibName = options.elementNameFor(entry.namespace.name, entry.klass.name);
    if (glibName === undefined) return [];
    return [
        `Also available as the \`${glibName}\` JSX element from \`@gtkx/jsx/${namespaceDirectory(entry.namespace)}\`; the \`${glibName}\` element page documents the JSX props.`,
    ];
};

const hierarchySection = (entry: GiSymbolBase & { klass: GirClass }, library: Library): string[] => {
    const ancestors = [...ancestorChain(library, entry.klass, entry.namespace.name)].slice(1).reverse();
    const interfaces = implementedInterfaces(entry.klass, entry.namespace, library).map((iface) =>
        qualifiedClassName(iface.namespace.name, iface.klass.name),
    );
    if (ancestors.length === 0 && interfaces.length === 0) return [];
    const lines = ["## Hierarchy"];
    if (ancestors.length > 0) {
        const parts = ancestors.map(
            (ancestor) => `\`${qualifiedClassName(ancestor.namespaceName, ancestor.klass.name)}\``,
        );
        parts.push(`**${qualifiedName(entry)}**`);
        lines.push(parts.join(" → "));
    }
    if (interfaces.length > 0) {
        lines.push(`Implements ${interfaces.map((name) => `\`${name}\``).join(", ")}.`);
    }
    return lines;
};

const prerequisitesLine = (entry: GiSymbolBase & { klass: GirClass }, library: Library): string[] => {
    const names = entry.klass.prerequisites.map((name) => {
        const resolved = library.resolveType(entry.namespace.name, name);
        if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) {
            return `\`${name}\``;
        }
        return `\`${qualifiedClassName(resolved.namespace.name, resolved.value.name)}\``;
    });
    if (names.length === 0) return [];
    return [`Requires ${names.join(", ")}.`];
};

type StaticSectionOptions = {
    title: string;
    intro: string;
    context: ModuleContext;
    callables: GirFunction[];
    returnTypeOverride?: string;
};

const staticSection = (options: StaticSectionOptions): string[] => {
    const rendered: { name: string; block: string }[] = [];
    for (const callable of dedupeCallables(options.callables)) {
        const signature = renderStaticSignature(options.context, callable, options.returnTypeOverride);
        if (signature === undefined) continue;
        rendered.push({
            name: signature.name,
            block: signatureBlock(signature.name, signature.signature, [docMarkdown(callable.doc)]),
        });
    }
    if (rendered.length === 0) return [];
    return [options.title, options.intro, ...sortStringsBy(rendered, (item) => item.name).map((item) => item.block)];
};

type MemberOwner = {
    klass: GirClass;
    namespace: GirNamespace;
    origin: string | undefined;
};

const memberOwners = (entry: GiSymbolBase & { klass: GirClass }, library: Library): MemberOwner[] => [
    { klass: entry.klass, namespace: entry.namespace, origin: undefined },
    ...newlyImplementedInterfaces(entry.klass, entry.namespace, library).map((iface) => ({
        klass: iface.klass,
        namespace: iface.namespace,
        origin: qualifiedClassName(iface.namespace.name, iface.klass.name),
    })),
];

const interfaceMethodNames = (library: Library, owner: MemberOwner): string[] => {
    const context = docsSignatureContext(owner.namespace, library);
    const className = toPascalCase(owner.klass.name);
    const methods = dedupeCallables(owner.klass.methods);
    const methodByName = indexMethodsByName(methods);
    const names: string[] = [];
    for (const callable of methods) {
        const rename = reservedSignalMemberRename(className, callable);
        const rendered = renderInstanceMethodSignature(context, { ...callable, doc: undefined }, methodByName, rename);
        if (rendered === undefined) continue;
        names.push(rename ?? methodExportName(callable));
    }
    return names;
};

type PropertyAccessorSetup = {
    context: ModuleContext;
    claimedNames: Set<string>;
    methodByName: Map<string, GirFunction>;
};

const propertyAccessorSetup = (
    owner: MemberOwner,
    library: Library,
    useClassRenames: boolean,
): PropertyAccessorSetup => {
    const claimedNames = new Set(
        useClassRenames
            ? classMethodEntries(library, owner.namespace, owner.klass).map((item) => item.name)
            : interfaceMethodNames(library, owner),
    );
    return {
        context: docsSignatureContext(owner.namespace, library),
        claimedNames,
        methodByName: indexMethodsByName(dedupeCallables(owner.klass.methods)),
    };
};

const propertyMeta = (property: GirProperty, accessor: ResolvedAccessor, origin: string | undefined): string => {
    const meta: string[] = [`\`${accessor.tsType}\``];
    if (property.defaultValue !== undefined) meta.push(`default \`${docsDefaultValue(property.defaultValue)}\``);
    if (property.constructOnly) meta.push("construct-only");
    if (!accessor.writable) meta.push("read-only");
    else if (!accessor.hasGetter) meta.push("write-only");
    if (origin !== undefined) meta.push(`from \`${origin}\``);
    return meta.join(" · ");
};

const propertiesSection = (
    entry: GiSymbolBase & { kind: "class" | "interface"; klass: GirClass },
    library: Library,
): string[] => {
    const seen = new Set<string>();
    const entries: { name: string; meta: string; doc: string }[] = [];
    for (const [index, owner] of memberOwners(entry, library).entries()) {
        const setup = propertyAccessorSetup(owner, library, index === 0 && entry.kind === "class");
        for (const property of owner.klass.properties) {
            const accessor = resolveAccessor({
                context: setup.context,
                property,
                claimedNames: setup.claimedNames,
                methodByName: setup.methodByName,
            });
            if (accessor === undefined || seen.has(accessor.jsName)) continue;
            seen.add(accessor.jsName);
            entries.push({
                name: accessor.jsName,
                meta: propertyMeta(property, accessor, owner.origin),
                doc: docMarkdown(property.doc),
            });
        }
    }
    if (entries.length === 0) return [];
    const intro = `Properties are read and written as instance fields; changes can be observed with \`connect("notify::<property-name>", handler)\`. Properties inherited from ancestors are documented on their own pages.`;
    const blocks = sortStringsBy(entries, (item) => item.name).map((item) => metaBlock(item.name, item.meta, item.doc));
    return ["## Properties", intro, ...blocks];
};

const signalsSection = (entry: GiSymbolBase & { klass: GirClass }, library: Library): string[] => {
    const seen = new Set<string>();
    const entries: { name: string; signature: string; doc: string; origin: string | undefined }[] = [];
    for (const owner of memberOwners(entry, library)) {
        for (const signal of owner.klass.signals) {
            if (seen.has(signal.name)) continue;
            seen.add(signal.name);
            entries.push({
                name: signal.name,
                signature: renderDocsSignalHandlerType(library, signal),
                doc: docMarkdown(signal.doc),
                origin: owner.origin,
            });
        }
    }
    if (entries.length === 0) return [];
    const intro = `Connect with \`instance.connect("<signal>", handler)\` or \`instance.on("<signal>", handler)\`. Signals inherited from ancestors are documented on their own pages.`;
    return ["## Signals", intro, ...originSignatureBlocks(entries)];
};

const classMethodsSection = (entry: GiSymbolBase & { klass: GirClass }, library: Library): string[] =>
    methodsSectionBlocks(
        classMethodEntries(library, entry.namespace, entry.klass),
        "Methods are called on instances. Methods inherited from ancestors are documented on their own pages.",
    );

const classPage = (
    entry: GiSymbolBase & { kind: "class" | "interface"; klass: GirClass },
    options: SymbolPageOptions,
): string => {
    const { library } = options;
    const qualified = qualifiedName(entry);
    const docsContext = docsSignatureContext(entry.namespace, library);
    const constructorsIntro = `Constructors are called on the class: \`${qualified}.new(...)\`.`;
    const staticIntro = `Static methods are called on the class: \`${qualified}.<method>(...)\`.`;
    return joinSections([
        ...pageHeader(entry, entry.kind),
        ...elementNote(entry, options),
        ...(entry.kind === "interface" ? prerequisitesLine(entry, library) : hierarchySection(entry, library)),
        ...staticSection({
            title: "## Constructors",
            intro: constructorsIntro,
            context: docsContext,
            callables: entry.klass.constructors,
            returnTypeOverride: qualified,
        }),
        ...staticSection({
            title: "## Static methods",
            intro: staticIntro,
            context: docsContext,
            callables: entry.klass.functions,
        }),
        ...propertiesSection(entry, library),
        ...signalsSection(entry, library),
        ...classMethodsSection(entry, library),
    ]);
};

export const renderSymbolPage = (entry: GiSymbolEntry, options: SymbolPageOptions): string => {
    switch (entry.kind) {
        case "class":
        case "interface":
            return classPage(entry, options);
        case "record":
            return recordPage(entry, options.library);
        case "enum":
            return enumPage(entry);
        case "callback":
            return callbackPage(entry, options.library);
        case "alias":
            return aliasPage(entry, options.library);
        case "function":
            return functionPage(entry, options.library);
        case "constant":
            return constantPage(entry, options.library);
    }
};

const recordInstanceEntries = (context: ModuleContext, record: GirRecord): SignatureEntry[] => {
    const entries: SignatureEntry[] = [];
    for (const callable of dedupeCallables(record.methods)) {
        const rendered = renderStaticSignature(context, callable);
        if (rendered === undefined) continue;
        entries.push({ name: rendered.name, signature: rendered.signature, doc: docMarkdown(callable.doc) });
    }
    return sortStringsBy(entries, (item) => item.name);
};

const recordPage = (entry: GiSymbolBase & { kind: "record"; record: GirRecord }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const qualified = qualifiedName(entry);
    const constructorsIntro = `Constructors are called on the class: \`${qualified}.new(...)\`.`;
    const staticIntro = `Static methods are called on the class: \`${qualified}.<method>(...)\`.`;
    const methodEntries = recordInstanceEntries(docsContext, entry.record);
    const claimedNames = new Set(methodEntries.map((item) => item.name));
    return joinSections([
        ...pageHeader(entry, entry.record.isUnion ? "union" : "record"),
        ...staticSection({
            title: "## Constructors",
            intro: constructorsIntro,
            context: docsContext,
            callables: entry.record.constructors,
            returnTypeOverride: qualified,
        }),
        ...staticSection({
            title: "## Static methods",
            intro: staticIntro,
            context: docsContext,
            callables: entry.record.functions,
        }),
        ...fieldsSection(entry.record, docsContext, claimedNames),
        ...methodsSectionBlocks(methodEntries, "Methods are called on instances."),
    ]);
};

const fieldsSection = (record: GirRecord, context: ModuleContext, claimedNames: Set<string>): string[] => {
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    const entries: { name: string; meta: string; doc: string }[] = [];
    for (const slot of slots) {
        const field = resolveRecordFieldEntry(context, slot, claimedNames);
        if (field === undefined) continue;
        entries.push({
            name: field.jsName,
            meta: [`\`${field.tsType}\``, ...(field.writable ? [] : ["read-only"])].join(" · "),
            doc: docMarkdown(field.doc),
        });
    }
    if (entries.length === 0) return [];
    const blocks = sortStringsBy(entries, (item) => item.name).map((item) => metaBlock(item.name, item.meta, item.doc));
    return ["## Fields", ...blocks];
};

const enumPage = (entry: GiSymbolBase & { kind: "enum"; enumeration: GirEnum }): string => {
    const { enumeration } = entry;
    const kindLabel = enumeration.errorDomain !== undefined ? "error domain" : enumeration.kind;
    const qualified = qualifiedName(entry);
    const rows = enumeration.members.map((member) => {
        const description = firstSentence(member.doc).replaceAll("|", "\\|");
        return `| \`${enumMemberKey(member.name)}\` | \`${member.value}\` | ${description} |`;
    });
    const usage =
        enumeration.errorDomain !== undefined
            ? `Members are error codes for the \`${enumeration.errorDomain}\` GError domain, accessed as \`${qualified}.<member>\`.`
            : `Members are accessed as \`${qualified}.<member>\`.`;
    const table = ["| Member | Value | Description |", "| --- | --- | --- |", ...rows].join("\n");
    return joinSections([...pageHeader(entry, kindLabel), "## Members", usage, table]);
};

const callbackPage = (entry: GiSymbolBase & { kind: "callback"; callback: GirCallback }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const fn = callbackAsFunction(entry.callback);
    const signature = `type ${entry.name} = (${renderMethodSignature(docsContext, fn)}) => ${renderMethodReturnType(docsContext, fn)}`;
    return joinSections([...pageHeader(entry, "callback"), "## Signature", `\`\`\`ts\n${signature}\n\`\`\``]);
};

const aliasPage = (entry: GiSymbolBase & { kind: "alias"; alias: GirAlias }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const category = entry.alias.cType === undefined ? undefined : primitiveCategory(entry.alias.cType);
    const target = category === "gtype" ? PRIMITIVE_TS_TYPE.gtype : renderTsType(docsContext, entry.alias.target);
    return joinSections([...pageHeader(entry, "alias"), `\`\`\`ts\ntype ${entry.name} = ${target}\n\`\`\``]);
};

const functionPage = (entry: GiSymbolBase & { kind: "function"; fn: GirFunction }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const signature = `function ${entry.name}(${renderMethodSignature(docsContext, entry.fn)}): ${renderMethodReturnType(docsContext, entry.fn)}`;
    return joinSections([...pageHeader(entry, "function"), `\`\`\`ts\n${signature}\n\`\`\``]);
};

const constantPage = (entry: GiSymbolBase & { kind: "constant"; constant: GirConstant }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const type = renderDocsType(library, entry.constant.type, false);
    return joinSections([
        ...pageHeader(entry, "constant"),
        `\`\`\`ts\nconst ${entry.name}: ${type} = ${constantLiteral(docsContext, entry.constant)}\n\`\`\``,
    ]);
};
