import type { ContainerProp, ElementProp } from "@gtkx/config";
import { sortStringsBy, toCamelIdentifier, upperFirst } from "@gtkx/utils";
import { ancestorChain } from "../gir/ancestry.js";
import type { GirClass } from "../gir/class.js";
import type { Library } from "../gir/library.js";
import { type GirNamespace, namespaceDirectory } from "../gir/namespace.js";
import type { GirSignal } from "../gir/parameter.js";
import { type GirProperty, isConstructableProperty } from "../gir/property.js";
import { createElementPropTypegen, type ElementPropTypegen } from "../store/react/element-prop-types.js";
import { assembleElementProps } from "../store/react/element-props.js";
import { buildGirIndex, type GirIndex } from "../store/react/gir-index.js";
import {
    type GlibNamedClass,
    glibNameOf,
    implementedInterfaces,
    newlyImplementedInterfaces,
    signalHandlerName,
} from "../store/react/intrinsic-elements.js";
import { isObjectProp } from "../store/react/props.js";
import {
    classMethodEntries,
    docMarkdown,
    docsDefaultValue,
    firstSentence,
    joinSections,
    metaBlock,
    methodsSectionBlocks,
    originSignatureBlocks,
    renderDocsSignalSignature,
    renderDocsType,
} from "./render.js";

export type ElementPageContext = {
    library: Library;
    girIndex: GirIndex;
    typegen: ElementPropTypegen;
    elementProps: Record<string, ElementProp[]>;
    linkFor: (glibName: string) => string | undefined;
};

export const createElementPageContext = (
    library: Library,
    elementProps: Record<string, ElementProp[]>,
    linkFor: (glibName: string) => string | undefined,
): ElementPageContext => {
    const girIndex = buildGirIndex(library);
    const applied = assembleElementProps(girIndex, elementProps);
    return {
        library,
        girIndex,
        typegen: createElementPropTypegen(girIndex, applied),
        elementProps: applied,
        linkFor,
    };
};

type MemberOwner = {
    klass: GirClass;
    namespace: GirNamespace;
    origin: string | undefined;
};

type PropEntry = {
    name: string;
    meta: string;
    doc: string;
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
    const ancestors = [...ancestorChain(context.library, entry.klass, entry.namespace.name)].slice(1).reverse();
    if (ancestors.length === 0) return [];
    const parts = ancestors.map((ancestor) => {
        const glib = glibNameOf(ancestor.klass);
        return glib === undefined ? `\`${ancestor.namespaceName}.${ancestor.klass.name}\`` : glibLabel(context, glib);
    });
    parts.push(`**${entry.glibName}**`);
    const lines = [`## Hierarchy`, parts.join(" → ")];
    const interfaces = implementedInterfaces(entry.klass, entry.namespace, context.library)
        .map((iface) => glibNameOf(iface.klass))
        .filter((name): name is string => name !== undefined);
    if (interfaces.length > 0) {
        lines.push(`Implements ${interfaces.map((name) => `\`${name}\``).join(", ")}.`);
    }
    return lines;
};

const callName = (call: ContainerProp["append"]): string | undefined =>
    call === undefined ? undefined : typeof call === "string" ? call : call.method;

const containerLine = (prop: ContainerProp, context: ElementPageContext): string => {
    const child = glibLabel(context, prop.child);
    const attach = callName(prop.append);
    const detail: string[] = [];
    if (attach !== undefined) detail.push(`attached with \`${attach}()\``);
    if (prop.autowrap !== undefined) {
        detail.push(`children are wrapped in a ${glibLabel(context, prop.autowrap)} before attaching`);
    }
    const suffix = detail.length > 0 ? ` (${detail.join("; ")})` : "";
    if (prop.prop === "children") return `- \`children\` accepts ${child} elements${suffix}.`;
    return `- \`${prop.prop}\` is a slot accepting ${child} elements${suffix}.`;
};

const childrenSection = (entry: GlibNamedClass, context: ElementPageContext): string[] => {
    const overlays = context.elementProps[entry.glibName] ?? [];
    const containers = overlays.filter((prop): prop is ContainerProp => prop.kind === "container");
    const lines = containers.map((prop) => containerLine(prop, context));
    if (lines.length === 0 && context.typegen.acceptsChildren(entry.glibName)) {
        lines.push("- `children` accepts child elements.");
    }
    if (lines.length === 0) return [];
    return ["## Children", lines.join("\n")];
};

const memberOwners = (entry: GlibNamedClass, context: ElementPageContext): MemberOwner[] => [
    { klass: entry.klass, namespace: entry.namespace, origin: undefined },
    ...newlyImplementedInterfaces(entry.klass, entry.namespace, context.library).map((iface) => ({
        klass: iface.klass,
        namespace: iface.namespace,
        origin: glibNameOf(iface.klass),
    })),
];

const propertyEntry = (
    context: ElementPageContext,
    owner: MemberOwner,
    property: GirProperty,
    jsName: string,
): PropEntry => {
    const object = isObjectProp(
        { library: context.library, klass: owner.klass, namespace: owner.namespace },
        property,
        jsName,
    );
    const baseType = renderDocsType(context.library, property.type, false);
    const type = object ? `${baseType} | ReactElement` : baseType;
    const meta: string[] = [`\`${type}\``];
    if (property.defaultValue !== undefined) meta.push(`default \`${docsDefaultValue(property.defaultValue)}\``);
    if (property.constructOnly) meta.push("construct-only");
    if (!isConstructableProperty(property)) meta.push(`read-only, observe with \`onNotify${upperFirst(jsName)}\``);
    if (owner.origin !== undefined) meta.push(`from \`${owner.origin}\``);
    return { name: jsName, meta: meta.join(" · "), doc: docMarkdown(property.doc) };
};

const overlayNote = (overlays: ElementProp[], name: string): string | undefined => {
    for (const overlay of overlays) {
        if (overlay.kind === "container" || overlay.prop !== name) continue;
        if (overlay.kind === "value") return `Applied with \`${callName(overlay.call)}()\`.`;
        if (overlay.kind === "list") return `Array prop; items are applied with \`${callName(overlay.add)}()\`.`;
        if (overlay.kind === "controlled-text") {
            return "Controlled: the element always reflects the prop value, including across user edits.";
        }
    }
    return undefined;
};

const cleanOverlayType = (type: string): string => type.replace(/\s*\|\s*undefined$/, "").replaceAll("$.", ".");

const overlayEntries = (entry: GlibNamedClass, context: ElementPageContext, seen: Set<string>): PropEntry[] => {
    const overlays = context.elementProps[entry.glibName] ?? [];
    const entries: PropEntry[] = [];
    const lines = context.typegen.classPropLines(entry.glibName, entry.klass, entry.namespace, new Map());
    for (const line of lines) {
        const match = line.match(/^([A-Za-z0-9_]+)\?: (.*);$/);
        if (match === null) continue;
        const [, name = "", rawType = ""] = match;
        if (seen.has(name)) continue;
        seen.add(name);
        const note = overlayNote(overlays, name) ?? "Element prop managed by GTKX.";
        entries.push({ name, meta: `\`${cleanOverlayType(rawType)}\``, doc: note });
    }
    return entries;
};

const withOverlayNote = (propEntry: PropEntry, note: string | undefined): PropEntry => {
    if (note === undefined) return propEntry;
    return { ...propEntry, doc: propEntry.doc.length > 0 ? `${note}\n\n${propEntry.doc}` : note };
};

const propertyEntries = (entry: GlibNamedClass, context: ElementPageContext, seen: Set<string>): PropEntry[] => {
    const overlays = context.elementProps[entry.glibName] ?? [];
    const entries: PropEntry[] = [];
    for (const owner of memberOwners(entry, context)) {
        for (const property of owner.klass.properties) {
            if (!property.introspectable) continue;
            const jsName = toCamelIdentifier(property.name);
            if (seen.has(jsName)) continue;
            seen.add(jsName);
            const propEntry = propertyEntry(context, owner, property, jsName);
            entries.push(withOverlayNote(propEntry, overlayNote(overlays, jsName)));
        }
    }
    return entries;
};

const propsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const seen = new Set<string>();
    const entries = [...propertyEntries(entry, context, seen), ...overlayEntries(entry, context, seen)];
    const intro = [
        `\`ref\` receives the \`${selfType}\` instance.`,
        `Every mutable property also has an \`onNotify<Prop>\` handler prop called with the new value when the property changes.`,
        `Props inherited from ancestor elements are documented on their own pages.`,
    ].join(" ");
    if (entries.length === 0) return ["## Props", intro];
    const sorted = sortStringsBy(entries, (item) => item.name);
    return ["## Props", intro, ...sorted.map((item) => metaBlock(item.name, item.meta, item.doc))];
};

type SignalEntry = {
    name: string;
    signature: string;
    doc: string;
    origin: string | undefined;
};

const signalsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const seen = new Set<string>();
    const entries: SignalEntry[] = [];
    const acceptSignal = (signal: GirSignal, origin: string | undefined): void => {
        const name = signalHandlerName(signal.name);
        if (seen.has(name)) return;
        seen.add(name);
        entries.push({
            name,
            signature: renderDocsSignalSignature(context.library, signal, selfType),
            doc: docMarkdown(signal.doc),
            origin,
        });
    };
    for (const owner of memberOwners(entry, context)) {
        for (const signal of owner.klass.signals) acceptSignal(signal, owner.origin);
    }
    if (entries.length === 0) return [];
    return ["## Signals", ...originSignatureBlocks(entries)];
};

const methodsSection = (entry: GlibNamedClass, context: ElementPageContext, selfType: string): string[] => {
    const entries = classMethodEntries(context.library, entry.namespace, entry.klass);
    const intro = `Methods are called on the \`${selfType}\` instance, obtained with the \`ref\` prop or imported from \`@gtkx/gi/${namespaceDirectory(entry.namespace)}\`. Methods inherited from ancestors are documented on their own pages.`;
    return methodsSectionBlocks(entries, intro);
};

export const renderElementPage = (entry: GlibNamedClass, context: ElementPageContext): string => {
    const selfType = `${entry.namespace.name}.${entry.klass.name}`;
    return joinSections([
        frontmatter(entry),
        `# ${entry.glibName}`,
        docMarkdown(entry.klass.doc),
        importBlock(entry),
        ...hierarchySection(entry, context),
        ...childrenSection(entry, context),
        ...propsSection(entry, context, selfType),
        ...signalsSection(entry, context, selfType),
        ...methodsSection(entry, context, selfType),
    ]);
};
