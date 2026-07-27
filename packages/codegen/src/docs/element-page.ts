import { sortStringsBy, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import { ancestorChain } from "../gir/ancestry.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import { elementPropTypeFor } from "../store/jsx/element-prop-imports.js";
import { buildGirIndex, type GirIndex } from "../store/jsx/gir-index.js";
import {
    getGlibName,
    type GlibNamedClass,
    implementedInterfaces,
    newlyImplementedInterfaces,
    signalHandlerName,
} from "../store/jsx/intrinsic-elements.js";
import { isObjectProp } from "../store/jsx/props.js";
import {
    classMethodEntries,
    docMarkdown,
    docsDefaultValue,
    firstSentence,
    implementsLine,
    joinSections,
    metaBlock,
    methodsSectionBlocks,
    originSignatureBlocks,
    renderDocsSignalSignature,
    renderDocsType,
} from "./render.js";

type ElementPageContext = {
    library: Library;
    girIndex: GirIndex;
    linkFor: (glibName: string) => string | undefined;
};

type MemberOwner = {
    klass: GirClass;
    namespace: GirNamespace;
    origin: string | undefined;
    glibName: string | undefined;
};

type PropEntry = {
    name: string;
    meta: string;
    doc: string;
};

type SignalEntry = {
    name: string;
    signature: string;
    doc: string;
    origin: string | undefined;
};

const createElementPageContext = (
    library: Library,
    linkFor: (glibName: string) => string | undefined,
): ElementPageContext => ({ library, girIndex: buildGirIndex(library), linkFor });

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

        return glib === undefined ? `\`${ancestor.namespaceName}.${ancestor.klass.name}\`` : glibLabel(context, glib);
    });

    parts.push(`**${entry.glibName}**`);
    const lines = ["## Hierarchy", parts.join(" → ")];

    const interfaces = implementedInterfaces(entry.klass, entry.namespace, context.library)
        .map((iface) => getGlibName(iface.klass))
        .filter((name): name is string => name !== undefined);

    lines.push(...implementsLine(interfaces));

    return lines;
};

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

const propertyEntry = (
    context: ElementPageContext,
    owner: MemberOwner,
    property: GirProperty,
    jsName: string,
): PropEntry => {
    const isObject = isObjectProp(
        { library: context.library, klass: owner.klass, namespace: owner.namespace },
        property,
        jsName,
    );

    const baseType = renderDocsType(context.library, property.type, false);
    const type = isObject ? `${baseType} | ReactElement` : baseType;
    const meta: string[] = [`\`${type}\``];

    if (property.defaultValue !== undefined) {
        meta.push(`default \`${docsDefaultValue(property.defaultValue)}\``);
    }

    if (property.constructOnly) {
        meta.push("construct-only");
    }

    if (!isConstructableProperty(property)) {
        meta.push(`read-only, observe with \`onNotify${upperFirst(jsName)}\``);
    }

    if (owner.origin !== undefined) {
        meta.push(`from \`${owner.origin}\``);
    }

    return { name: jsName, meta: meta.join(" · "), doc: docMarkdown(property.doc) };
};

const propJsName = (property: GirProperty, seen: Set<string>): string | undefined => {
    if (!property.introspectable) {
        return undefined;
    }

    const jsName = toCamelIdentifier(property.name);

    if (seen.has(jsName)) {
        return undefined;
    }

    seen.add(jsName);

    return jsName;
};

const ownerPropEntries = (context: ElementPageContext, owner: MemberOwner, seen: Set<string>): PropEntry[] => {
    const entries: PropEntry[] = [];

    for (const property of owner.klass.properties) {
        const jsName = propJsName(property, seen);

        if (jsName !== undefined) {
            entries.push(propertyEntry(context, owner, property, jsName));
        }
    }

    return entries;
};

const propertyEntries = (entry: GlibNamedClass, context: ElementPageContext, seen: Set<string>): PropEntry[] => {
    const entries: PropEntry[] = [];

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

    const sorted = sortStringsBy(entries, (item) => item.name);

    return ["## Props", intro, ...sorted.map((item) => metaBlock(item.name, item.meta, item.doc))];
};

const ownerSignalEntries = (
    context: ElementPageContext,
    owner: MemberOwner,
    selfType: string,
    seen: Set<string>,
): SignalEntry[] => {
    const entries: SignalEntry[] = [];

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
            origin: owner.origin,
        });
    }

    return entries;
};

const signalsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const seen: Set<string> = new Set();
    const entries: SignalEntry[] = [];

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

const renderElementPage = (entry: GlibNamedClass, context: ElementPageContext): string => {
    const selfType = `${entry.namespace.name}.${entry.klass.name}`;

    return joinSections([
        frontmatter(entry),
        `# ${entry.glibName}`,
        docMarkdown(entry.klass.doc),
        importBlock(entry),
        ...hierarchySection(entry, context),
        ...propsSection(entry, context, selfType),
        ...signalsSection(entry, context, selfType),
        ...methodsSection(entry, context, selfType),
    ]);
};

export { createElementPageContext, renderElementPage, type ElementPageContext };
