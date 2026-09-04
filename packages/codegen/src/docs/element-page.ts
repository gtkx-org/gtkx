import { toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import type { ModuleContext } from "../writer/context.js";
import type { HandwrittenProp } from "./handwritten-props.js";
import { ancestorClassMethodNames } from "../analysis/inheritance.js";
import { ancestorChain } from "../gir/ancestry.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import { annotationSpec } from "../store/gi/doc-spec.js";
import {
    resolveAccessor,
    type ResolvedAccessor,
    resolvePropertyMetadata,
} from "../store/gi/property-accessor.js";
import { acceptedChildTypesFor } from "../store/jsx/accepted-child-types.js";
import { elementPropTypeFor } from "../store/jsx/element-prop-imports.js";
import {
    getGlibName,
    type GlibNamedClass,
    implementedInterfaces,
    newlyImplementedInterfaces,
    signalHandlerName,
} from "../store/jsx/intrinsic-elements.js";
import { isOmittedProp } from "../store/jsx/omitted-props.js";
import { isObjectProp } from "../store/jsx/props.js";
import { handwrittenPropsFor } from "./handwritten-props.js";
import {
    annotationNotes,
    classMethodEntries,
    docMarkdown,
    docsSignatureContext,
    firstSentence,
    implementsLine,
    joinSections,
    type MetaDocEntry,
    methodsSectionBlocks,
    originSignatureBlocks,
    type OriginSignatureEntry,
    propertyMetaLine,
    qualifiedClassName,
    renderDocsSignalSignature,
    renderDocsType,
    signalTags,
    sortedMetaBlocks,
    staticSectionBlocks,
} from "./render.js";

/** Shared state an element's reference page renders from. */
type ElementPageContext = {
    /** Parsed GIR the element, its ancestors, and the interfaces it implements are read from. */
    library: Library;
    /** Resolves a GLib type name to the URL of its page, undefined when it has none. */
    linkFor: (glibName: string) => string | undefined;
};

type MemberOwner = {
    klass: GirClass;
    namespace: GirNamespace;
    origin: string | undefined;
    glibName: string | undefined;
};

type PropertyAccessorSetup = {
    context: ModuleContext;
    claimedNames: Set<string>;
    inheritedNames: Set<string> | undefined;
};

type PropertyEntryOptions = {
    context: ElementPageContext;
    owner: MemberOwner;
    property: GirProperty;
    jsName: string;
    hiddenAccessor: ResolvedAccessor | undefined;
};

const frontmatter = (entry: GlibNamedClass): string => {
    const sentence = firstSentence(entry.klass.doc);
    const description = sentence.length > 0 ? sentence : `API reference for the ${entry.glibName} element.`;

    return `---\ndescription: ${JSON.stringify(description)}\n---`;
};

const importBlock = (entry: GlibNamedClass): string =>
    `\`\`\`tsx\nimport { ${entry.glibName} } from "@gtkx/jsx/${namespaceDirectory(entry.namespace)}";\n\`\`\``;

const glibLabel = (context: ElementPageContext, glibName: string): string => {
    const link = context.linkFor(glibName);

    return link === undefined ? `\`${glibName}\`` : `[${glibName}](${link})`;
};

const hierarchySection = (entry: GlibNamedClass, context: ElementPageContext): string[] => {
    const ancestors = [...ancestorChain(context.library, entry.klass, entry.namespace.name)].slice(1).toReversed();

    if (ancestors.length === 0) {
        return [];
    }

    const parts = ancestors.map((ancestor) => {
        const glib = getGlibName(ancestor.klass);

        return glib === undefined
            ? `\`${qualifiedClassName(ancestor.namespaceName, ancestor.klass.name)}\``
            : glibLabel(context, glib);
    });

    parts.push(`**${entry.glibName}**`);
    const lines = ["## Hierarchy", parts.join(" → ")];

    const interfaces = implementedInterfaces(entry.klass, entry.namespace, context.library)
        .map((iface) => getGlibName(iface.klass))
        .filter((name): name is string => name !== undefined);

    lines.push(...implementsLine(interfaces));

    return lines;
};

const hasDescriptorFreeGetter = (accessor: ResolvedAccessor | undefined): boolean =>
    accessor?.supportsDescriptorFreeAccess === true && accessor.hasGetter;

const hasDescriptorFreeSetter = (accessor: ResolvedAccessor | undefined): boolean =>
    accessor?.supportsDescriptorFreeAccess === true && accessor.isWritable;

const memberOwners = (entry: GlibNamedClass, context: ElementPageContext): MemberOwner[] => [
    { klass: entry.klass, namespace: entry.namespace, origin: undefined, glibName: entry.glibName },
    ...newlyImplementedInterfaces(
        entry.klass,
        entry.namespace,
        context.library,
        (glibName) => glibName !== undefined && elementPropTypeFor(glibName) !== undefined,
    ).map((iface) => {
        const glibName = getGlibName(iface.klass);

        return { klass: iface.klass, namespace: iface.namespace, origin: glibName, glibName };
    }),
];

const propertyEntry = (options: PropertyEntryOptions): MetaDocEntry => {
    const { context, owner, property, jsName, hiddenAccessor } = options;
    const isObject = isObjectProp(context.library, property);
    const baseType = renderDocsType(context.library, property.type, false);
    const type = isObject ? `${baseType} | ReactElement` : baseType;

    const accessNotes = [
        ...(isConstructableProperty(property)
            ? []
            : [`read-only, observe with \`onNotify${upperFirst(jsName)}\``]),
        ...(hasDescriptorFreeGetter(hiddenAccessor)
            ? ["instance read with `GObject.getProperty`"]
            : []),
        ...(hasDescriptorFreeSetter(hiddenAccessor)
            ? ["instance write with `GObject.setProperty`"]
            : []),
    ];

    return {
        name: jsName,
        meta: propertyMetaLine({ type, property, accessNotes, origin: owner.origin }),
        doc: docMarkdown(property.doc),
        tags: annotationSpec(property.annotations),
    };
};

const propertyAccessorSetup = (context: ElementPageContext, owner: MemberOwner): PropertyAccessorSetup => {
    const signatureContext = docsSignatureContext(owner.namespace, context.library);
    const claimedNames = new Set(
        classMethodEntries(context.library, owner.namespace, owner.klass).map((entry) => entry.name),
    );

    return {
        context: signatureContext,
        claimedNames,
        inheritedNames: owner.origin === undefined
            ? ancestorClassMethodNames(signatureContext, owner.klass)
            : undefined,
    };
};

const hiddenPropertyAccessor = (
    setup: PropertyAccessorSetup,
    property: GirProperty,
): ResolvedAccessor | undefined => {
    const metadata = resolvePropertyMetadata(setup.context, property);
    const field = resolveAccessor({
        context: setup.context,
        property,
        claimedNames: setup.claimedNames,
        inheritedNames: setup.inheritedNames,
    });

    return metadata !== undefined && field === undefined ? metadata : undefined;
};

const handwrittenPropMeta = (prop: HandwrittenProp, owner: MemberOwner): string =>
    [`\`${prop.type}\``, ...(owner.origin === undefined ? [] : [`from \`${owner.origin}\``])].join(" · ");

const acceptedChildTypesDoc = (context: ElementPageContext, owner: MemberOwner): string => {
    if (owner.glibName === undefined) {
        return "";
    }

    const accepted = acceptedChildTypesFor(owner.glibName);

    if (accepted.length === 0) {
        return "";
    }

    const labels = accepted.map((name) => glibLabel(context, name));
    const typeList = labels.length === 1
        ? labels[0] ?? ""
        : `${labels.slice(0, -1).join(", ")} or ${labels.at(-1) ?? ""}`;

    return (
        "This remains a React `ReactNode` slot, so fragments, arrays, conditionals, and nullish values work " +
        `normally. Each GTKX element rendered into it must create ${typeList} or a subtype.`
    );
};

const handwrittenPropEntry = (
    context: ElementPageContext,
    owner: MemberOwner,
    prop: HandwrittenProp,
): MetaDocEntry => {
    const childTypesDoc = prop.name === "children" ? acceptedChildTypesDoc(context, owner) : "";
    const doc = [prop.doc, childTypesDoc].filter((part) => part.length > 0).join("\n\n");

    return { name: prop.name, meta: handwrittenPropMeta(prop, owner), doc };
};

const handwrittenPropEntries = (
    context: ElementPageContext,
    owner: MemberOwner,
    seen: Set<string>,
): MetaDocEntry[] => {
    const declared = owner.glibName === undefined ? undefined : elementPropTypeFor(owner.glibName);

    if (declared === undefined) {
        return [];
    }

    const entries: MetaDocEntry[] = [];

    for (const prop of handwrittenPropsFor(declared)) {
        if (seen.has(prop.name)) {
            continue;
        }

        seen.add(prop.name);
        entries.push(handwrittenPropEntry(context, owner, prop));
    }

    return entries;
};

const propJsName = (property: GirProperty, owner: MemberOwner, seen: Set<string>): string | undefined => {
    if (!property.introspectable) {
        return undefined;
    }

    const jsName = toCamelIdentifier(property.name);

    if (seen.has(jsName) || isOmittedProp(owner.glibName, jsName)) {
        return undefined;
    }

    seen.add(jsName);

    return jsName;
};

const ownerPropEntries = (context: ElementPageContext, owner: MemberOwner, seen: Set<string>): MetaDocEntry[] => {
    const entries: MetaDocEntry[] = [...handwrittenPropEntries(context, owner, seen)];
    const setup = propertyAccessorSetup(context, owner);

    for (const property of owner.klass.properties) {
        const jsName = propJsName(property, owner, seen);

        if (jsName !== undefined) {
            entries.push(propertyEntry({
                context,
                owner,
                property,
                jsName,
                hiddenAccessor: hiddenPropertyAccessor(setup, property),
            }));
        }
    }

    return entries;
};

const propertyEntries = (entry: GlibNamedClass, context: ElementPageContext, seen: Set<string>): MetaDocEntry[] => {
    const entries: MetaDocEntry[] = [];

    for (const owner of memberOwners(entry, context)) {
        entries.push(...ownerPropEntries(context, owner, seen));
    }

    return entries;
};

const propsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const seen: Set<string> = new Set();
    const entries = propertyEntries(entry, context, seen);

    const intro = [
        `\`ref\` receives the \`${selfType}\` instance.`,
        "Every mutable property also has an `onNotify<Prop>` handler prop called with the new value " +
        "when the property changes.",
        "Props inherited from ancestor elements are documented on their own pages.",
    ].join(" ");

    if (entries.length === 0) {
        return ["## Props", intro];
    }

    return ["## Props", intro, ...sortedMetaBlocks(entries)];
};

const ownerSignalEntries = (
    context: ElementPageContext,
    owner: MemberOwner,
    selfType: string,
    seen: Set<string>,
): OriginSignatureEntry[] => {
    const entries: OriginSignatureEntry[] = [];

    for (const signal of owner.klass.signals) {
        const name = signalHandlerName(signal.name);

        if (seen.has(name)) {
            continue;
        }

        seen.add(name);

        entries.push({
            name,
            signature: renderDocsSignalSignature(context.library, signal, selfType),
            doc: docMarkdown(signal.doc),
            tags: signalTags(signal, true),
            origin: owner.origin,
        });
    }

    return entries;
};

const signalsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const seen: Set<string> = new Set();
    const entries: OriginSignatureEntry[] = [];

    for (const owner of memberOwners(entry, context)) {
        entries.push(...ownerSignalEntries(context, owner, selfType, seen));
    }

    if (entries.length === 0) {
        return [];
    }

    return ["## Signals", ...originSignatureBlocks(entries)];
};

const methodsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const entries = classMethodEntries(context.library, entry.namespace, entry.klass);
    const importPath = `@gtkx/gi/${namespaceDirectory(entry.namespace)}`;

    const intro =
        `Methods are called on the \`${selfType}\` instance, obtained with the \`ref\` prop or ` +
        `imported from \`${importPath}\`. Methods inherited from ancestors are documented on their own pages.`;

    return methodsSectionBlocks(entries, intro);
};

const staticMethodsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const importPath = `@gtkx/gi/${namespaceDirectory(entry.namespace)}`;
    const callables = [...entry.klass.constructors, ...entry.klass.functions];

    return staticSectionBlocks({
        title: "## Static methods",
        intro: `Static methods are called on \`${selfType}\`, imported from \`${importPath}\`.`,
        context: docsSignatureContext(entry.namespace, context.library),
        callables,
        siblings: callables,
    });
};

const gtkxNotes = (entry: GlibNamedClass): string[] => {
    if (entry.glibName !== "AdwApplication") {
        return [];
    }

    return [
        "> **GTKX JSX:** The automatic `shortcuts-dialog.ui` behavior described above does not apply to " +
        "GTKX applications because JSX is the interface definition and GTKX does not load `.ui` " +
        "definitions. Define the action, accelerator, and `AdwShortcutsDialog` in JSX as shown in " +
        "[Menus, Accelerators, and Shortcuts](https://gtkx.dev/v2/tutorial/actions-menus-shortcuts).",
    ];
};

const renderElementPage = (entry: GlibNamedClass, context: ElementPageContext): string => {
    const selfType = qualifiedClassName(entry.namespace.name, entry.klass.name);

    return joinSections([
        frontmatter(entry),
        `# ${entry.glibName}`,
        docMarkdown(entry.klass.doc),
        ...gtkxNotes(entry),
        ...annotationNotes(entry.klass.annotations),
        importBlock(entry),
        ...hierarchySection(entry, context),
        ...staticMethodsSection(entry, context, selfType),
        ...propsSection(entry, context, selfType),
        ...signalsSection(entry, context, selfType),
        ...methodsSection(entry, context, selfType),
    ]);
};

export { renderElementPage, type ElementPageContext };
