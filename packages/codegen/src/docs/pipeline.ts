import { sortStringsBy } from "@gtkx/utils";
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { computeGiFingerprint, FINGERPRINT_FILENAME, isGiStoreFresh } from "../fingerprint.js";
import { Library } from "../gir/library.js";
import { namespaceDirectory } from "../gir/namespace.js";
import { type ElementProps, setElementProps } from "../store/jsx/element-prop-imports.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "../store/jsx/intrinsic-elements.js";
import { type OmittedProps, setOmittedProps } from "../store/jsx/omitted-props.js";
import { createElementPageContext, type ElementPageContext, renderElementPage } from "./element-page.js";
import { elementSlug, firstSentence, namespaceOrder } from "./render.js";

type DocsElementLink = {
    text: string;
    link: string;
};

type DocsNamespace = {
    name: string;
    directory: string;
    link: string;
    elements: DocsElementLink[];
};

type DocsOptions = {
    libraries: string[];
    girPath: string[];
    outDir: string;
    basePath?: string;
    props?: ElementProps;
    omittedProps?: OmittedProps;
    isForced?: boolean;
};

type DocsManifest = {
    namespaces: DocsNamespace[];
};

type GeneratedDocs = {
    pages: { path: string; content: string }[];
    namespaces: DocsNamespace[];
};

type Page = { path: string; content: string };
type NamespacePages = { docs: DocsNamespace; pages: Page[] };

type DocsResult = {
    isRegenerated: boolean;
    namespaces: DocsNamespace[];
};

const MANIFEST_FILENAME = "manifest.json";

const namespaceIndexPage = (namespace: DocsNamespace, elements: GlibNamedClass[]): string => {
    const rows = elements.map((entry, index) => {
        const link = namespace.elements[index]?.link ?? "";
        const description = firstSentence(entry.klass.doc).replaceAll("|", String.raw`\|`);

        return `| [${entry.glibName}](${link}) | ${description} |`;
    });

    const description =
        `Reference pages for the ${String(namespace.elements.length)} JSX elements in ` +
        `the ${namespace.name} namespace.`;

    return [
        "---",
        `description: ${JSON.stringify(description)}`,
        "---",
        "",
        `# ${namespace.name} elements`,
        "",
        `Elements in this namespace are imported from \`@gtkx/jsx/${namespace.directory}\`; the matching ` +
        `classes, enums, and functions are imported from \`@gtkx/gi/${namespace.directory}\`.`,
        "",
        "| Element | Description |",
        "| --- | --- |",
        ...rows,
        "",
    ].join("\n");
};

const rootIndexPage = (namespaces: DocsNamespace[], libraries: string[]): string => {
    const rows = namespaces.map(
        (ns) => `| [${ns.name}](${ns.link}) | \`@gtkx/jsx/${ns.directory}\` | ${String(ns.elements.length)} |`,
    );

    const librariesList = libraries.map((library) => `\`${library}\``).join(", ");

    return [
        "---",
        "description: \"Generated reference documentation for every JSX element in this project's GIR libraries.\"",
        "---",
        "",
        "# Element Reference",
        "",
        "This reference documents every JSX element generated from the GObject-Introspection data for " +
        `${librariesList}, together with the namespaces they pull in. It is produced by \`gtkx docs\` ` +
        "using the same pipeline that generates the `@gtkx/jsx` and `@gtkx/gi` bindings, so every page " +
        "matches the types your editor sees.",
        "",
        "Each element page lists:",
        "",
        "- **Props** derived from GObject properties, plus the element props GTKX adds (such as `children` " +
        "and named slots), with types, defaults, and upstream documentation.",
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

const groupElementsByNamespace = (elements: GlibNamedClass[]): Map<string, GlibNamedClass[]> => {
    const byNamespace: Map<string, GlibNamedClass[]> = new Map();

    for (const entry of elements) {
        const list = byNamespace.get(entry.namespace.name) ?? [];
        list.push(entry);
        byNamespace.set(entry.namespace.name, list);
    }

    return byNamespace;
};

const buildElementLinks = (elements: GlibNamedClass[], basePath: string): Map<string, string> => {
    const linkByGlibName: Map<string, string> = new Map();

    for (const entry of elements) {
        const directory = namespaceDirectory(entry.namespace);
        const link = `${basePath}/${directory}/${elementSlug(entry.klass.name)}`;

        if (linkByGlibName.values().some((existing) => existing === link)) {
            throw new Error(`Docs page slug collision for ${entry.glibName} at ${link}`);
        }

        linkByGlibName.set(entry.glibName, link);
    }

    return linkByGlibName;
};

const namespacePages = (input: {
    name: string;
    elements: GlibNamedClass[];
    basePath: string;
    linkByGlibName: Map<string, string>;
    pageContext: ElementPageContext;
}): NamespacePages => {
    const { name, elements, basePath, linkByGlibName, pageContext } = input;
    const directory = name.toLowerCase();

    const docs: DocsNamespace = {
        name,
        directory,
        link: `${basePath}/${directory}/`,
        elements: elements.map((entry) => ({ text: entry.glibName, link: linkByGlibName.get(entry.glibName) ?? "" })),
    };

    const pages: Page[] = elements.map((entry) => ({
        path: `${directory}/${elementSlug(entry.klass.name)}.md`,
        content: renderElementPage(entry, pageContext),
    }));

    pages.push({ path: `${directory}/index.md`, content: namespaceIndexPage(docs, elements) });

    return { docs, pages };
};

const generatePages = (options: DocsOptions, basePath: string, library: Library): GeneratedDocs => {
    const intrinsicElements = collectIntrinsicElementClasses(library);
    const byNamespace = groupElementsByNamespace(intrinsicElements);
    const linkByGlibName = buildElementLinks(intrinsicElements, basePath);
    const pageContext = createElementPageContext(library, (glibName: string) => linkByGlibName.get(glibName));
    const pages: Page[] = [];
    const namespaces: DocsNamespace[] = [];
    const orderedNames = sortStringsBy(byNamespace.keys(), namespaceOrder);

    for (const name of orderedNames) {
        const elements = sortStringsBy(byNamespace.get(name) ?? [], (entry) => entry.glibName);
        const result = namespacePages({ name, elements, basePath, linkByGlibName, pageContext });
        pages.push(...result.pages);
        namespaces.push(result.docs);
    }

    pages.push({ path: "index.md", content: rootIndexPage(namespaces, options.libraries) });

    return { pages, namespaces };
};

const cachedDocsResult = (options: DocsOptions, manifestPath: string): DocsResult | undefined => {
    if (options.isForced === true || !isGiStoreFresh(options.outDir, options.libraries, options.girPath)) {
        return undefined;
    }

    if (!existsSync(manifestPath)) {
        return undefined;
    }

    const manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as DocsManifest;

    return { isRegenerated: false, namespaces: manifest.namespaces };
};

const writePages = (outDir: string, pages: Page[]): void => {
    for (const page of pages) {
        const target = join(outDir, page.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, page.content);
    }
};

const writeDocs = (options: DocsOptions): DocsResult => {
    setElementProps(options.props ?? {});
    setOmittedProps(options.omittedProps ?? {});
    const basePath = options.basePath ?? "/reference";
    const manifestPath = join(options.outDir, MANIFEST_FILENAME);
    const cached = cachedDocsResult(options, manifestPath);

    if (cached !== undefined) {
        return cached;
    }

    const library = Library.load(options.libraries, options.girPath);
    const { pages, namespaces } = generatePages(options, basePath, library);
    rmSync(options.outDir, { recursive: true, force: true });
    mkdirSync(options.outDir, { recursive: true });
    writePages(options.outDir, pages);
    const manifest: DocsManifest = { namespaces };
    writeFileSync(manifestPath, JSON.stringify(manifest));

    writeFileSync(
        join(options.outDir, FINGERPRINT_FILENAME),
        JSON.stringify(computeGiFingerprint(library.girFiles, options.libraries, options.girPath)),
    );

    return { isRegenerated: true, namespaces };
};

export { writeDocs };
