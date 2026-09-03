import { sanitizeTypeIdentifier, sortStringsBy, upperFirst } from "@gtkx/utils";
import type { GirAnnotations } from "../gir/annotations.js";
import type { GirClass } from "../gir/class.js";
import type { EnumMember, GirEnum } from "../gir/enum.js";
import type { GirFunction } from "../gir/function.js";
import type { Library } from "../gir/library.js";
import type { GirRecord } from "../gir/record.js";
import type { ModuleContext } from "../writer/context.js";
import type { JsDocSpec } from "../writer/doc.js";
import { ancestorClassMethodNames } from "../analysis/inheritance.js";
import { renderTsType } from "../analysis/ts-type.js";
import { ancestorChain } from "../gir/ancestry.js";
import { callbackAsFunction, type GirCallback } from "../gir/callback.js";
import { type GirAlias, type GirConstant, type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { PRIMITIVE_TS_TYPE, primitiveCategory } from "../gir/primitives.js";
import { callableSpec } from "../store/gi/callable-doc.js";
import {
    dedupeCallables,
    instanceScope,
    matchStaticFinishFunction,
    renderInstanceMethodSignature,
    renderStaticSignature,
} from "../store/gi/callables.js";
import { constantLiteral } from "../store/gi/constant.js";
import { annotationSpec } from "../store/gi/doc-spec.js";
import { enumMemberKey } from "../store/gi/enum.js";
import {
    methodExportName,
    renderMethodReturnType,
    renderMethodSignature,
    renderPromisifiedSignature,
} from "../store/gi/method.js";
import {
    resolveAccessor,
    type ResolvedAccessor,
    resolvePropertyMetadata,
} from "../store/gi/property-accessor.js";
import { resolveRecordFieldEntry } from "../store/gi/record-field-accessor.js";
import { computeRecordFieldSlots } from "../store/gi/record-layout.js";
import { vfuncEntries } from "../store/gi/vtable.js";
import { implementedInterfaces, newlyImplementedInterfaces } from "../store/jsx/intrinsic-elements.js";
import {
    annotationNotes,
    classMethodEntries,
    deprecationMeta,
    docMarkdown,
    docsSignatureContext,
    firstSentence,
    implementsLine,
    joinSections,
    type MetaDocEntry,
    methodsSectionBlocks,
    originSignatureBlocks,
    type OriginSignatureEntry,
    plainText,
    propertyMetaLine,
    qualifiedClassName,
    renderDocsSignalHandlerType,
    renderDocsType,
    signalTags,
    signatureBlock,
    type SignatureEntry,
    signatureEntryBlock,
    sortedMetaBlocks,
    tagNotes,
} from "./render.js";

/** What every indexed GIR symbol carries, whatever its kind. */
type GiSymbolBase = {
    /** GIR namespace declaring the symbol. */
    namespace: GirNamespace;
    /** Name the bindings export it under: camelCase for functions, PascalCase for classes, the GIR name otherwise. */
    name: string;
    /** Raw gtk-doc text from the GIR, undefined when the symbol is undocumented. */
    doc: string | undefined;
};

/** A GIR symbol the reference indexes, discriminated by `kind` and carrying the GIR node its page renders from. */
type GiSymbolEntry =
    | (GiSymbolBase & {
        /** Renders the class page: hierarchy, constructors, static methods, properties, signals, and methods. */
        kind: "class" | "interface";
        /** Supplies the ancestry, members, and, on an interface, the vtable slots an implementer fills. */
        klass: GirClass;
    }) |
    (GiSymbolBase & {
        /** Renders the record page, labeled `union` when the record is one. */
        kind: "record";
        /** Supplies the constructors, static methods, fields, and instance methods. */
        record: GirRecord;
    }) |
    (GiSymbolBase & {
        /** Renders the page for an enumeration, a flags type, or an error domain, as a table of members. */
        kind: "enum";
        /** Supplies the members, their values, and the GError domain when the enum carries one. */
        enumeration: GirEnum;
    }) |
    (GiSymbolBase & {
        /** Renders the callback page as a single function type signature. */
        kind: "callback";
        /** Supplies the parameters and return type the signature is rendered from. */
        callback: GirCallback;
    }) |
    (GiSymbolBase & {
        /** Renders the alias page as the type the alias resolves to. */
        kind: "alias";
        /** Supplies the target type the page prints. */
        alias: GirAlias;
    }) |
    (GiSymbolBase & {
        /** Renders the page for a namespace-level function, promisified when a finish function matches it. */
        kind: "function";
        /** Supplies the parameters and return type the signature is rendered from. */
        fn: GirFunction;
    }) |
    (GiSymbolBase & {
        /** Renders the page for a namespace-level constant, showing its type and literal value. */
        kind: "constant";
        /** Supplies the type and the value the literal is emitted from. */
        constant: GirConstant;
    });

type ClassSymbol = GiSymbolBase & { klass: GirClass };
type ClassPageSymbol = ClassSymbol & { kind: "class" | "interface" };

/** What {@link renderSymbolPage} needs besides the entry itself. */
type SymbolPageOptions = {
    /** Parsed GIR the page resolves ancestry, interfaces, and referenced types against. */
    library: Library;
    /** Looks up the JSX element a class is also available as, undefined when it has none. */
    elementNameFor: (namespaceName: string, className: string) => string | undefined;
};

type StaticSectionOptions = {
    title: string;
    intro: string;
    context: ModuleContext;
    callables: GirFunction[];
    siblings: GirFunction[];
    returnTypeOverride?: string;
};

type MemberOwner = {
    klass: GirClass;
    namespace: GirNamespace;
    origin: string | undefined;
};

type PropertyAccessorSetup = {
    context: ModuleContext;
    claimedNames: Set<string>;
    inheritedNames: Set<string> | undefined;
};

type ResolvedRecordField = NonNullable<ReturnType<typeof resolveRecordFieldEntry>>;

const qualifiedName = (entry: GiSymbolBase): string => `${entry.namespace.name}.${entry.name}`;
const pageTagNotes = (spec: JsDocSpec): string[] => tagNotes({ ...spec, deprecated: undefined, since: undefined });

const frontmatter = (entry: GiSymbolBase, kindLabel: string): string => {
    const sentence = firstSentence(entry.doc);
    const description = sentence.length > 0 ? sentence : `API reference for the ${qualifiedName(entry)} ${kindLabel}.`;

    return `---\ndescription: ${JSON.stringify(description)}\n---`;
};

const kindLine = (kindLabel: string, namespace: GirNamespace): string =>
    `\`${kindLabel}\` in \`@gtkx/gi/${namespaceDirectory(namespace)}\``;

const importBlock = (entry: GiSymbolBase): string =>
    `\`\`\`ts\nimport * as ${entry.namespace.name} from "@gtkx/gi/${namespaceDirectory(entry.namespace)}";\n\`\`\``;

const entryAnnotations = (entry: GiSymbolEntry): GirAnnotations => {
    switch (entry.kind) {
        case "class":
        case "interface": {
            return entry.klass.annotations;
        }
        case "record": {
            return entry.record.annotations;
        }
        case "enum": {
            return entry.enumeration.annotations;
        }
        case "callback": {
            return entry.callback.annotations;
        }
        case "alias": {
            return entry.alias.annotations;
        }
        case "function": {
            return entry.fn.annotations;
        }
        case "constant": {
            return entry.constant.annotations;
        }
    }
};

const pageHeader = (entry: GiSymbolEntry, kindLabel: string): string[] => [
    frontmatter(entry, kindLabel),
    `# ${qualifiedName(entry)}`,
    kindLine(kindLabel, entry.namespace),
    docMarkdown(entry.doc),
    ...annotationNotes(entryAnnotations(entry)),
    importBlock(entry),
];

const elementNote = (entry: ClassSymbol, options: SymbolPageOptions): string[] => {
    const glibName = options.elementNameFor(entry.namespace.name, entry.klass.name);

    if (glibName === undefined) {
        return [];
    }

    return [
        `Also available as the \`${glibName}\` JSX element from ` +
        `\`@gtkx/jsx/${namespaceDirectory(entry.namespace)}\`; the \`${glibName}\` element page ` +
        "documents the JSX props.",
    ];
};

const hierarchySection = (entry: ClassSymbol, library: Library): string[] => {
    const ancestors = [...ancestorChain(library, entry.klass, entry.namespace.name)].slice(1).toReversed();

    const interfaces = implementedInterfaces(entry.klass, entry.namespace, library).map((iface) =>
        qualifiedClassName(iface.namespace.name, iface.klass.name),
    );

    if (ancestors.length === 0 && interfaces.length === 0) {
        return [];
    }

    const lines = ["## Hierarchy"];

    if (ancestors.length > 0) {
        const parts = ancestors.map(
            (ancestor) => `\`${qualifiedClassName(ancestor.namespaceName, ancestor.klass.name)}\``,
        );

        parts.push(`**${qualifiedName(entry)}**`);
        lines.push(parts.join(" → "));
    }

    lines.push(...implementsLine(interfaces));

    return lines;
};

const prerequisitesLine = (entry: ClassSymbol, library: Library): string[] => {
    const names = entry.klass.prerequisites.map((name) => {
        const resolved = library.resolveType(entry.namespace.name, name);

        if (resolved === undefined || (resolved.kind !== "class" && resolved.kind !== "interface")) {
            return `\`${name}\``;
        }

        return `\`${qualifiedClassName(resolved.namespace.name, resolved.value.name)}\``;
    });

    if (names.length === 0) {
        return [];
    }

    return [`Requires ${names.join(", ")}.`];
};

const interfaceImplementingIntro = (entry: ClassSymbol): string => {
    const qualified = qualifiedName(entry);

    return (
        `A class fills these vtable slots to adopt the interface: declare \`implements ${qualified}Impl\` ` +
        `on it and pass \`${qualified}\` in the \`implements\` option of \`registerClass\`. Every slot is ` +
        "optional, and one the class leaves out keeps whatever the interface installs by default. The " +
        "methods, properties, and signals above come from GLib dispatch."
    );
};

const classImplementingIntro = (entry: ClassSymbol): string => {
    const qualified = qualifiedName(entry);

    return (
        "A subclass declared with `registerClass` overrides these virtual methods to change what " +
        `\`${qualified}\` does: define the slot as a method on the subclass and call \`super.<slot>(...)\` ` +
        "to chain up to the inherited implementation. A slot the subclass leaves out keeps that " +
        "implementation unchanged."
    );
};

const implementingIntro = (entry: ClassPageSymbol): string =>
    entry.kind === "interface" ? interfaceImplementingIntro(entry) : classImplementingIntro(entry);

const implementingSection = (entry: ClassPageSymbol, library: Library): string[] => {
    const context = docsSignatureContext(entry.namespace, library);
    const entries = vfuncEntries(context, entry.namespace.name, entry.klass);

    if (entries.length === 0) {
        return [];
    }

    const blocks = sortStringsBy(entries, (item) => item.name).map((item) =>
        signatureBlock(item.name, item.signature, [docMarkdown(item.doc)]));

    return ["## Implementing", implementingIntro(entry), ...blocks];
};

const staticEntry = (options: StaticSectionOptions, callable: GirFunction): SignatureEntry | undefined => {
    const signature = renderStaticSignature(options.context, callable, {
        returnTypeOverride: options.returnTypeOverride,
        siblings: options.siblings,
    });

    if (signature === undefined) {
        return undefined;
    }

    const finishFn = matchStaticFinishFunction(options.context, callable, options.siblings);

    return {
        name: signature.name,
        signature: signature.signature,
        doc: docMarkdown(callable.doc),
        tags: callableSpec(options.context, callable, { finishFn }),
    };
};

const staticSection = (options: StaticSectionOptions): string[] => {
    const entries: SignatureEntry[] = [];

    for (const callable of dedupeCallables(options.callables)) {
        const entry = staticEntry(options, callable);

        if (entry !== undefined) {
            entries.push(entry);
        }
    }

    if (entries.length === 0) {
        return [];
    }

    const blocks = sortStringsBy(entries, (item) => item.name).map((item) => signatureEntryBlock(item));

    return [options.title, options.intro, ...blocks];
};

const memberOwners = (entry: ClassSymbol, library: Library): MemberOwner[] => [
    { klass: entry.klass, namespace: entry.namespace, origin: undefined },
    ...newlyImplementedInterfaces(entry.klass, entry.namespace, library).map((iface) => ({
        klass: iface.klass,
        namespace: iface.namespace,
        origin: qualifiedClassName(iface.namespace.name, iface.klass.name),
    })),
];

const interfaceMethodNames = (library: Library, owner: MemberOwner): string[] => {
    const context = docsSignatureContext(owner.namespace, library);
    const className = sanitizeTypeIdentifier(owner.klass.name);
    const methods = dedupeCallables(owner.klass.methods);

    const scope = instanceScope(className, {
        constructors: dedupeCallables(owner.klass.constructors),
        functions: dedupeCallables(owner.klass.functions),
        methods,
    });

    const names: string[] = [];

    for (const callable of methods) {
        const rendered = renderInstanceMethodSignature(context, { ...callable, doc: undefined }, scope);

        if (rendered === undefined) {
            continue;
        }

        names.push(methodExportName(callable));
    }

    return names;
};

const propertyAccessorSetup = (
    owner: MemberOwner,
    library: Library,
    isUseClassRenames: boolean,
): PropertyAccessorSetup => {
    const context = docsSignatureContext(owner.namespace, library);
    const claimedNames = new Set(
        isUseClassRenames
            ? classMethodEntries(library, owner.namespace, owner.klass).map((item) => item.name)
            : interfaceMethodNames(library, owner),
    );

    return {
        context,
        claimedNames,
        inheritedNames: isUseClassRenames ? ancestorClassMethodNames(context, owner.klass) : undefined,
    };
};

const getAccessNotes = (accessor: ResolvedAccessor): string[] => {
    if (!accessor.isWritable) {
        return ["read-only"];
    }

    if (!accessor.hasGetter) {
        return ["write-only"];
    }

    return accessor.readType === accessor.writeType ? [] : [`writes \`${accessor.writeType}\``];
};

const documentedAccessorType = (accessor: ResolvedAccessor): string =>
    accessor.hasGetter ? accessor.readType : accessor.writeType;

const hiddenPropertyAccessNotes = (accessor: ResolvedAccessor): string[] => [
    ...getAccessNotes(accessor),
    ...(accessor.hasGetter && accessor.supportsDescriptorFreeAccess
        ? ["read with `GObject.getObjectProperty`"]
        : []),
    ...(accessor.isWritable && accessor.supportsDescriptorFreeAccess
        ? ["write with `GObject.setObjectProperty`"]
        : []),
];

const ownerPropertyEntries = (owner: MemberOwner, setup: PropertyAccessorSetup, seen: Set<string>): MetaDocEntry[] => {
    const entries: MetaDocEntry[] = [];

    for (const property of owner.klass.properties) {
        const fieldAccessor = resolveAccessor({
            context: setup.context,
            property,
            claimedNames: setup.claimedNames,
            inheritedNames: setup.inheritedNames,
        });
        const accessor = fieldAccessor ?? resolvePropertyMetadata(setup.context, property);

        if (accessor === undefined || seen.has(accessor.jsName)) {
            continue;
        }

        seen.add(accessor.jsName);

        entries.push({
            name: accessor.jsName,
            meta: propertyMetaLine({
                type: documentedAccessorType(accessor),
                property,
                accessNotes: fieldAccessor === undefined
                    ? hiddenPropertyAccessNotes(accessor)
                    : getAccessNotes(accessor),
                origin: owner.origin,
            }),
            doc: docMarkdown(property.doc),
            tags: annotationSpec(property.annotations),
        });
    }

    return entries;
};

const propertiesSection = (entry: ClassPageSymbol, library: Library): string[] => {
    const seen: Set<string> = new Set();
    const entries: MetaDocEntry[] = [];

    for (const [index, owner] of memberOwners(entry, library).entries()) {
        const isUseClassRenames = index === 0 && entry.kind === "class";
        const setup = propertyAccessorSetup(owner, library, isUseClassRenames);
        entries.push(...ownerPropertyEntries(owner, setup, seen));
    }

    if (entries.length === 0) {
        return [];
    }

    const intro =
        "Properties are normally read and written as instance fields. Collision exceptions are marked with " +
        "their `GObject.getObjectProperty` or `GObject.setObjectProperty` escape hatch. Changes can be observed " +
        "with `GObject.signalConnect(instance, \"notify::<property-name>\", handler)`. Properties inherited " +
        "from ancestors are documented on their own pages.";

    return ["## Properties", intro, ...sortedMetaBlocks(entries)];
};

const ownerSignalEntries = (owner: MemberOwner, library: Library, seen: Set<string>): OriginSignatureEntry[] => {
    const entries: OriginSignatureEntry[] = [];

    for (const signal of owner.klass.signals) {
        if (seen.has(signal.name)) {
            continue;
        }

        seen.add(signal.name);

        entries.push({
            name: signal.name,
            signature: renderDocsSignalHandlerType(library, signal),
            doc: docMarkdown(signal.doc),
            tags: signalTags(signal, false),
            origin: owner.origin,
        });
    }

    return entries;
};

const signalsSection = (entry: ClassSymbol, library: Library): string[] => {
    const seen: Set<string> = new Set();
    const entries: OriginSignatureEntry[] = [];

    for (const owner of memberOwners(entry, library)) {
        entries.push(...ownerSignalEntries(owner, library, seen));
    }

    if (entries.length === 0) {
        return [];
    }

    const intro =
        "Connect with `GObject.signalConnect(instance, \"<signal>\", handler)`. " +
        "Signals inherited from ancestors are documented on their own pages.";

    return ["## Signals", intro, ...originSignatureBlocks(entries)];
};

const classMethodsSection = (entry: ClassSymbol, library: Library): string[] =>
    methodsSectionBlocks(
        classMethodEntries(library, entry.namespace, entry.klass),
        "Methods are called on instances. Methods inherited from ancestors are documented on their own pages.",
    );

const classPage = (entry: ClassPageSymbol, options: SymbolPageOptions): string => {
    const { library } = options;
    const qualified = qualifiedName(entry);
    const docsContext = docsSignatureContext(entry.namespace, library);
    const constructorsIntro = `Constructors are called on the class: \`${qualified}.new(...)\`.`;
    const staticIntro = `Static methods are called on the class: \`${qualified}.<method>(...)\`.`;
    const staticSiblings = [...entry.klass.constructors, ...entry.klass.functions];

    return joinSections([
        ...pageHeader(entry, entry.kind),
        ...elementNote(entry, options),
        ...(entry.kind === "interface" ? prerequisitesLine(entry, library) : hierarchySection(entry, library)),
        ...staticSection({
            title: "## Constructors",
            intro: constructorsIntro,
            context: docsContext,
            callables: entry.klass.constructors,
            siblings: staticSiblings,
            returnTypeOverride: qualified,
        }),
        ...staticSection({
            title: "## Static methods",
            intro: staticIntro,
            context: docsContext,
            callables: entry.klass.functions,
            siblings: staticSiblings,
        }),
        ...propertiesSection(entry, library),
        ...signalsSection(entry, library),
        ...classMethodsSection(entry, library),
        ...implementingSection(entry, library),
    ]);
};

const renderSymbolPage = (entry: GiSymbolEntry, options: SymbolPageOptions): string => {
    switch (entry.kind) {
        case "class":
        case "interface": {
            return classPage(entry, options);
        }
        case "record": {
            return recordPage(entry, options.library);
        }
        case "enum": {
            return enumPage(entry);
        }
        case "callback": {
            return callbackPage(entry, options.library);
        }
        case "alias": {
            return aliasPage(entry, options.library);
        }
        case "function": {
            return functionPage(entry, options.library);
        }
        case "constant": {
            return constantPage(entry, options.library);
        }
    }
};

const recordInstanceEntries = (context: ModuleContext, record: GirRecord): SignatureEntry[] => {
    const entries: SignatureEntry[] = [];

    for (const callable of dedupeCallables(record.methods)) {
        const rendered = renderStaticSignature(context, callable);

        if (rendered === undefined) {
            continue;
        }

        entries.push({
            name: rendered.name,
            signature: rendered.signature,
            doc: docMarkdown(callable.doc),
            tags: callableSpec(context, callable, {}),
        });
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
    const staticSiblings = [...entry.record.constructors, ...entry.record.functions];

    return joinSections([
        ...pageHeader(entry, entry.record.isUnion ? "union" : "record"),
        ...staticSection({
            title: "## Constructors",
            intro: constructorsIntro,
            context: docsContext,
            callables: entry.record.constructors,
            siblings: staticSiblings,
            returnTypeOverride: qualified,
        }),
        ...staticSection({
            title: "## Static methods",
            intro: staticIntro,
            context: docsContext,
            callables: entry.record.functions,
            siblings: staticSiblings,
        }),
        ...fieldsSection(entry.record, docsContext, claimedNames),
        ...methodsSectionBlocks(methodEntries, "Methods are called on instances."),
    ]);
};

const fieldMeta = (field: ResolvedRecordField): string =>
    [
        `\`${field.tsType}\``,
        ...(field.isWritable ? [] : ["read-only"]),
        ...deprecationMeta(field.annotations),
    ].join(" · ");

const fieldsSection = (record: GirRecord, context: ModuleContext, claimedNames: Set<string>): string[] => {
    const { slots } = computeRecordFieldSlots(context, record.fields, record.isUnion);
    const entries: MetaDocEntry[] = [];

    for (const slot of slots) {
        const field = resolveRecordFieldEntry(context, slot, claimedNames, record.fields);

        if (field === undefined) {
            continue;
        }

        entries.push({
            name: field.jsName,
            meta: fieldMeta(field),
            doc: docMarkdown(field.doc),
            tags: annotationSpec(field.annotations),
        });
    }

    if (entries.length === 0) {
        return [];
    }

    return ["## Fields", ...sortedMetaBlocks(entries)];
};

const memberDescription = (member: EnumMember): string => {
    const markers = deprecationMeta(member.annotations).map((note) => `**${upperFirst(note)}.**`);

    return [...markers, plainText(member.doc)]
        .filter((part) => part.length > 0)
        .join(" ")
        .replaceAll("|", String.raw`\|`);
};

const enumPage = (entry: GiSymbolBase & { kind: "enum"; enumeration: GirEnum }): string => {
    const { enumeration } = entry;
    const kindLabel = enumeration.errorDomain === undefined ? enumeration.kind : "error domain";
    const qualified = qualifiedName(entry);

    const rows = enumeration.members.map(
        (member) => `| \`${enumMemberKey(member.name)}\` | \`${member.value}\` | ${memberDescription(member)} |`,
    );

    const usage =
        enumeration.errorDomain === undefined
            ? `Members are accessed as \`${qualified}.<member>\`.`
            : `Members are error codes for the \`${enumeration.errorDomain}\` GError domain, ` +
                `accessed as \`${qualified}.<member>\`.`;

    const table = ["| Member | Value | Description |", "| --- | --- | --- |", ...rows].join("\n");

    return joinSections([...pageHeader(entry, kindLabel), "## Members", usage, table]);
};

const callbackPage = (entry: GiSymbolBase & { kind: "callback"; callback: GirCallback }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const fn = callbackAsFunction(entry.callback);
    const parameters = renderMethodSignature(docsContext, fn);
    const signature = `type ${entry.name} = (${parameters}) => ${renderMethodReturnType(docsContext, fn)}`;

    return joinSections([
        ...pageHeader(entry, "callback"),
        "## Signature",
        `\`\`\`ts\n${signature}\n\`\`\``,
        ...pageTagNotes(callableSpec(docsContext, fn, {})),
    ]);
};

const aliasPage = (entry: GiSymbolBase & { kind: "alias"; alias: GirAlias }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const category = entry.alias.cType === undefined ? undefined : primitiveCategory(entry.alias.cType);
    const target = category === "gtype" ? PRIMITIVE_TS_TYPE.gtype : renderTsType(docsContext, entry.alias.target);

    return joinSections([...pageHeader(entry, "alias"), `\`\`\`ts\ntype ${entry.name} = ${target}\n\`\`\``]);
};

const functionSignature = (context: ModuleContext, name: string, fn: GirFunction, siblings: GirFunction[]): string => {
    const finishFn = matchStaticFinishFunction(context, fn, siblings);

    if (finishFn !== undefined) {
        const { signature, returnType } = renderPromisifiedSignature(context, fn, finishFn);

        return `function ${name}(${signature}): ${returnType}`;
    }

    return `function ${name}(${renderMethodSignature(context, fn)}): ${renderMethodReturnType(context, fn)}`;
};

const functionPage = (entry: GiSymbolBase & { kind: "function"; fn: GirFunction }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const siblings = entry.namespace.functions;
    const signature = functionSignature(docsContext, entry.name, entry.fn, siblings);
    const finishFn = matchStaticFinishFunction(docsContext, entry.fn, siblings);
    const spec = callableSpec(docsContext, entry.fn, { finishFn });

    return joinSections([...pageHeader(entry, "function"), `\`\`\`ts\n${signature}\n\`\`\``, ...pageTagNotes(spec)]);
};

const constantPage = (entry: GiSymbolBase & { kind: "constant"; constant: GirConstant }, library: Library): string => {
    const docsContext = docsSignatureContext(entry.namespace, library);
    const type = renderDocsType(library, entry.constant.type, false);

    return joinSections([
        ...pageHeader(entry, "constant"),
        `\`\`\`ts\nconst ${entry.name}: ${type} = ${constantLiteral(docsContext, entry.constant)}\n\`\`\``,
    ]);
};

export { renderSymbolPage, type GiSymbolEntry, type SymbolPageOptions };
