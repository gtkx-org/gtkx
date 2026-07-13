import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import type { ElementProp } from "@gtkx/config";
import { sortStringsBy } from "@gtkx/utils";
import { computeFingerprint, FINGERPRINT_FILENAME, isStoreFresh } from "../fingerprint.js";
import { Library } from "../gir/library.js";
import { namespaceDirectory } from "../gir/namespace.js";
import { createElementPropTypegen } from "../store/react/element-prop-types.js";
import { assembleElementProps } from "../store/react/element-props.js";
import { buildGirIndex } from "../store/react/gir-index.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "../store/react/intrinsic-elements.js";
import { type ElementPageContext, renderElementPage } from "./element-page.js";
import { elementSlug, firstSentence } from "./render.js";

export type DocsElementLink = {
    text: string;
    link: string;
};

export type DocsNamespace = {
    name: string;
    directory: string;
    link: string;
    elements: DocsElementLink[];
};

export type DocsOptions = {
    libraries: string[];
    girPath: string[];
    outDir: string;
    basePath?: string;
    elementProps?: Record<string, ElementProp[]>;
    force?: boolean;
};

type DocsManifest = {
    namespaces: DocsNamespace[];
};

const MANIFEST_FILENAME = "manifest.json";

const LEADING_NAMESPACES = ["Gtk", "Adw"];

const namespaceOrder = (name: string): string => {
    const index = LEADING_NAMESPACES.indexOf(name);
    return index === -1 ? `1${name}` : `0${index}`;
};

const namespaceIndexPage = (namespace: DocsNamespace, elements: GlibNamedClass[]): string => {
    const rows = elements.map((entry, index) => {
        const link = namespace.elements[index]?.link ?? "";
        const description = firstSentence(entry.klass.doc).replaceAll("|", "\\|");
        return `| [${entry.glibName}](${link}) | ${description} |`;
    });
    return [
        "---",
        `description: ${JSON.stringify(`Reference pages for the ${namespace.elements.length} JSX elements in the ${namespace.name} namespace.`)}`,
        "---",
        "",
        `# ${namespace.name} elements`,
        "",
        `Elements in this namespace are imported from \`@gtkx/jsx/${namespace.directory}\`; the matching classes, enums, and functions are imported from \`@gtkx/gi/${namespace.directory}\`.`,
        "",
        "| Element | Description |",
        "| --- | --- |",
        ...rows,
        "",
    ].join("\n");
};

const rootIndexPage = (namespaces: DocsNamespace[], libraries: string[]): string => {
    const rows = namespaces.map(
        (ns) => `| [${ns.name}](${ns.link}) | \`@gtkx/jsx/${ns.directory}\` | ${ns.elements.length} |`,
    );
    const librariesList = libraries.map((library) => `\`${library}\``).join(", ");
    return [
        "---",
        `description: "Generated reference documentation for every JSX element in this project's GIR libraries."`,
        "---",
        "",
        "# Element Reference",
        "",
        `This reference documents every JSX element generated from the GObject-Introspection data for ${librariesList}, together with the namespaces they pull in. It is produced by \`gtkx docs\` using the same pipeline that generates the \`@gtkx/jsx\` and \`@gtkx/gi\` bindings, so every page matches the types your editor sees.`,
        "",
        "Each element page lists:",
        "",
        "- **Props** derived from GObject properties, plus the element props GTKX adds (such as `children` and named slots), with types, defaults, and upstream documentation.",
        "- **Signals** as `on<Signal>` handler props with their exact handler signatures.",
        "- **Methods** available on the underlying instance through the `ref` prop.",
        "",
        "## Namespaces",
        "",
        "| Namespace | Import | Elements |",
        "| --- | --- | --- |",
        ...rows,
        "",
    ].join("\n");
};

type GeneratedDocs = {
    pages: { path: string; content: string }[];
    namespaces: DocsNamespace[];
};

const generatePages = (options: DocsOptions, basePath: string, library: Library): GeneratedDocs => {
    const girIndex = buildGirIndex(library);
    const applied = assembleElementProps(girIndex, options.elementProps ?? {});
    const typegen = createElementPropTypegen(girIndex, applied);
    const intrinsicElements = collectIntrinsicElementClasses(library);

    const byNamespace = new Map<string, GlibNamedClass[]>();
    for (const entry of intrinsicElements) {
        const list = byNamespace.get(entry.namespace.name) ?? [];
        list.push(entry);
        byNamespace.set(entry.namespace.name, list);
    }

    const linkByGlibName = new Map<string, string>();
    for (const entry of intrinsicElements) {
        const directory = namespaceDirectory(entry.namespace);
        const slug = elementSlug(entry.klass.name);
        const link = `${basePath}/${directory}/${slug}`;
        const existing = [...linkByGlibName.values()].includes(link);
        if (existing) throw new Error(`Docs page slug collision for ${entry.glibName} at ${link}`);
        linkByGlibName.set(entry.glibName, link);
    }

    const pageContext: ElementPageContext = {
        library,
        girIndex,
        typegen,
        elementProps: applied,
        linkFor: (glibName) => linkByGlibName.get(glibName),
    };

    const pages: { path: string; content: string }[] = [];
    const namespaces: DocsNamespace[] = [];
    const orderedNames = sortStringsBy([...byNamespace.keys()], namespaceOrder);
    for (const name of orderedNames) {
        const elements = sortStringsBy(byNamespace.get(name) ?? [], (entry) => entry.glibName);
        const directory = name.toLowerCase();
        const namespaceDocs: DocsNamespace = {
            name,
            directory,
            link: `${basePath}/${directory}/`,
            elements: elements.map((entry) => ({
                text: entry.glibName,
                link: linkByGlibName.get(entry.glibName) ?? "",
            })),
        };
        for (const entry of elements) {
            const slug = elementSlug(entry.klass.name);
            pages.push({ path: `${directory}/${slug}.md`, content: renderElementPage(entry, pageContext) });
        }
        pages.push({ path: `${directory}/index.md`, content: namespaceIndexPage(namespaceDocs, elements) });
        namespaces.push(namespaceDocs);
    }
    pages.push({ path: "index.md", content: rootIndexPage(namespaces, options.libraries) });
    return { pages, namespaces };
};

export type DocsResult = {
    regenerated: boolean;
    namespaces: DocsNamespace[];
};

export const writeDocs = (options: DocsOptions): DocsResult => {
    const basePath = options.basePath ?? "/reference";
    const elementProps = options.elementProps ?? {};
    const manifestPath = join(options.outDir, MANIFEST_FILENAME);
    if (options.force !== true && isStoreFresh(options.outDir, options.libraries, elementProps)) {
        if (existsSync(manifestPath)) {
            const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as DocsManifest;
            return { regenerated: false, namespaces: manifest.namespaces };
        }
    }

    const library = Library.load(options.libraries, options.girPath);
    const { pages, namespaces } = generatePages(options, basePath, library);

    rmSync(options.outDir, { recursive: true, force: true });
    mkdirSync(options.outDir, { recursive: true });
    for (const page of pages) {
        const target = join(options.outDir, page.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, page.content);
    }
    const manifest: DocsManifest = { namespaces };
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writeFileSync(
        join(options.outDir, FINGERPRINT_FILENAME),
        JSON.stringify({
            value: computeFingerprint(library.girFiles, options.libraries, elementProps),
            girFiles: library.girFiles,
            libraries: options.libraries,
        }),
    );
    return { regenerated: true, namespaces };
};
