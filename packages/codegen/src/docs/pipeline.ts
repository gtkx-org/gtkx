import { sortStringsBy } from "@gtkx/utils";
import { mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import {
    computeDocsFingerprint,
    type DocsFingerprintInput,
    FINGERPRINT_FILENAME,
    type GiInputs,
    isDocsOutputFresh,
} from "../fingerprint.js";
import { Library } from "../gir/library.js";
import { namespaceDirectory } from "../gir/namespace.js";
import { arrayGuard, hasFields, isString } from "../guards.js";
import { readJsonFile } from "../json.js";
import { type ElementProps, setElementProps } from "../store/jsx/element-prop-imports.js";
import { collectIntrinsicElementClasses, type GlibNamedClass } from "../store/jsx/intrinsic-elements.js";
import { type OmittedProps, setOmittedProps } from "../store/jsx/omitted-props.js";
import { type ElementPageContext, renderElementPage } from "./element-page.js";
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
    isByteArrayTyped?: boolean;
    isValueUnwrapped?: boolean;
    isFinishTrimmed?: boolean;
    isInoutInPlace?: boolean;
};

type DocsManifest = {
    generator: string;
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
const MANIFEST_GENERATOR = "gtkx-docs";
const ROOT_INDEX_FILENAME = "index.md";
const DEFAULT_BASE_PATH = "/reference";

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

const isEntryInsideOutDir = (value: string): boolean =>
    value.length > 0 && value !== "." && value !== ".." && !value.includes("/") && !value.includes("\\");

const isChildEntry = (value: unknown): value is string => isString(value) && isEntryInsideOutDir(value);

const ownedEntry = (entry: string, source: string): string => {
    if (isEntryInsideOutDir(entry)) {
        return entry;
    }

    throw new Error(
        `Refusing to generate documentation outside the output directory: ${source} maps to \`${entry}\`, ` +
        "which is not an entry inside it. The GIR that declares it is malformed.",
    );
};

const elementPagePath = (directory: string, entry: GlibNamedClass): string => {
    const slug = ownedEntry(elementSlug(entry.klass.name), `the element ${entry.glibName}`);

    return `${directory}/${slug}.md`;
};

const namespacePages = (input: {
    name: string;
    elements: GlibNamedClass[];
    basePath: string;
    linkByGlibName: Map<string, string>;
    pageContext: ElementPageContext;
}): NamespacePages => {
    const { name, elements, basePath, linkByGlibName, pageContext } = input;
    const directory = ownedEntry(namespaceDirectory({ name }), `the GIR namespace ${name}`);

    const docs: DocsNamespace = {
        name,
        directory,
        link: `${basePath}/${directory}/`,
        elements: elements.map((entry) => ({ text: entry.glibName, link: linkByGlibName.get(entry.glibName) ?? "" })),
    };

    const pages: Page[] = elements.map((entry) => ({
        path: elementPagePath(directory, entry),
        content: renderElementPage(entry, pageContext),
    }));

    pages.push({ path: `${directory}/index.md`, content: namespaceIndexPage(docs, elements) });

    return { docs, pages };
};

const generatePages = (options: DocsOptions, basePath: string, library: Library): GeneratedDocs => {
    const intrinsicElements = collectIntrinsicElementClasses(library);
    const byNamespace = groupElementsByNamespace(intrinsicElements);
    const linkByGlibName = buildElementLinks(intrinsicElements, basePath);
    const pageContext: ElementPageContext = { library, linkFor: (glibName) => linkByGlibName.get(glibName) };
    const pages: Page[] = [];
    const namespaces: DocsNamespace[] = [];
    const orderedNames = sortStringsBy(byNamespace.keys(), namespaceOrder);

    for (const name of orderedNames) {
        const elements = sortStringsBy(byNamespace.get(name) ?? [], (entry) => entry.glibName);
        const result = namespacePages({ name, elements, basePath, linkByGlibName, pageContext });
        pages.push(...result.pages);
        namespaces.push(result.docs);
    }

    pages.push({ path: ROOT_INDEX_FILENAME, content: rootIndexPage(namespaces, options.libraries) });

    return { pages, namespaces };
};

const isGeneratorTag = (value: unknown): value is string => value === MANIFEST_GENERATOR;

const isDocsElementLink = (value: unknown): value is DocsElementLink =>
    hasFields<DocsElementLink>(value, { text: isString, link: isString });

const isDocsNamespace = (value: unknown): value is DocsNamespace =>
    hasFields<DocsNamespace>(value, {
        name: isString,
        directory: isChildEntry,
        link: isString,
        elements: arrayGuard(isDocsElementLink),
    });

const isDocsManifest = (value: unknown): value is DocsManifest =>
    hasFields<DocsManifest>(value, { generator: isGeneratorTag, namespaces: arrayGuard(isDocsNamespace) });

const readDocsManifest = (manifestPath: string): DocsManifest | undefined => {
    const parsed = readJsonFile(manifestPath);

    return isDocsManifest(parsed) ? parsed : undefined;
};

const outDirRefusal = (outDir: string, reason: string): Error =>
    new Error(
        `Refusing to generate documentation into ${outDir}: ${reason}. Point the output directory at an ` +
        "empty directory or at one gtkx generated, or remove it yourself first.",
    );

const giInputs = (options: DocsOptions, girFiles: string[]): GiInputs => ({
    girFiles,
    libraries: options.libraries,
    girPath: options.girPath,
    storeVersion: undefined,
    isByteArrayTyped: options.isByteArrayTyped === true,
    isValueUnwrapped: options.isValueUnwrapped === true,
    isFinishTrimmed: options.isFinishTrimmed === true,
    isInoutInPlace: options.isInoutInPlace === true,
});

const assertOwnedOutDir = (options: DocsOptions, manifest: DocsManifest | undefined): void => {
    const stats = statSync(options.outDir, { throwIfNoEntry: false });

    if (stats === undefined) {
        return;
    }

    if (!stats.isDirectory()) {
        throw outDirRefusal(options.outDir, "it already exists and is not a directory");
    }

    if (manifest !== undefined || readdirSync(options.outDir).length === 0) {
        return;
    }

    throw outDirRefusal(
        options.outDir,
        `it is not empty and holds no ${MANIFEST_FILENAME} written by \`gtkx docs\`, ` +
        "so its contents are not gtkx's to replace",
    );
};

const clearOutDir = (options: DocsOptions, manifest: DocsManifest | undefined): void => {
    if (manifest === undefined) {
        return;
    }

    const entries = [
        ...manifest.namespaces.map((namespace) => namespace.directory),
        ROOT_INDEX_FILENAME,
        MANIFEST_FILENAME,
        FINGERPRINT_FILENAME,
    ];

    for (const entry of entries) {
        rmSync(join(options.outDir, entry), { recursive: true, force: true });
    }
};

const cachedDocsResult = (
    options: DocsOptions,
    manifest: DocsManifest | undefined,
    input: DocsFingerprintInput,
): DocsResult | undefined => {
    if (manifest === undefined || options.isForced === true) {
        return undefined;
    }

    if (!isDocsOutputFresh(options.outDir, giInputs(options, []), input)) {
        return undefined;
    }

    return { isRegenerated: false, namespaces: manifest.namespaces };
};

const writePages = (outDir: string, pages: Page[]): void => {
    for (const page of pages) {
        const target = join(outDir, page.path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, page.content);
    }
};

const docsFingerprintInput = (options: DocsOptions): DocsFingerprintInput => ({
    basePath: options.basePath ?? DEFAULT_BASE_PATH,
    props: options.props ?? {},
    omittedProps: options.omittedProps ?? {},
});

const writeDocs = (options: DocsOptions): DocsResult => {
    const input = docsFingerprintInput(options);
    setElementProps(input.props);
    setOmittedProps(input.omittedProps);
    const manifestPath = join(options.outDir, MANIFEST_FILENAME);
    const previous = readDocsManifest(manifestPath);
    const cached = cachedDocsResult(options, previous, input);

    if (cached !== undefined) {
        return cached;
    }

    assertOwnedOutDir(options, previous);

    const library = Library.load(options.libraries, options.girPath, {
        isByteArrayTyped: options.isByteArrayTyped === true,
        isValueUnwrapped: options.isValueUnwrapped === true,
        isFinishTrimmed: options.isFinishTrimmed === true,
        isInoutInPlace: options.isInoutInPlace === true,
    });

    const { pages, namespaces } = generatePages(options, input.basePath, library);
    clearOutDir(options, previous);
    mkdirSync(options.outDir, { recursive: true });
    const manifest: DocsManifest = { generator: MANIFEST_GENERATOR, namespaces };
    writeFileSync(manifestPath, JSON.stringify(manifest));
    writePages(options.outDir, pages);
    const fingerprint = computeDocsFingerprint(giInputs(options, library.girFiles), input);
    writeFileSync(join(options.outDir, FINGERPRINT_FILENAME), JSON.stringify(fingerprint));

    return { isRegenerated: true, namespaces };
};

export { writeDocs };
