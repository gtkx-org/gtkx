import type { ExtractedKey, ExtractedKeysMap, Logger, Plugin } from "i18next-cli";
import { isPathInside, isPathWithin, toPosixPath } from "@gtkx/utils";
import { runExtractor } from "i18next-cli";
import {
    existsSync,
    mkdirSync,
    mkdtempSync,
    readFileSync,
    rmSync,
    writeFileSync,
} from "node:fs";
import { dirname, isAbsolute, join, relative, resolve } from "node:path";
import type { CatalogProject } from "./catalogs.js";
import { runCliTool } from "../internal/run-cli-tool.js";
import { replaceCatalogTemplate } from "./catalog-template.js";
import { metadataTemplateFiles } from "./metadata-templates.js";
import { clearI18nResources, i18nToolkitConfig } from "./types.js";

type SourceLocation = {
    file: string;
    line?: number | undefined;
    column?: number | undefined;
};

type SourceMessage = {
    context: string | null;
    locations: SourceLocation[];
    namespace: string;
    plural: string | null;
    singular: string;
    sourceKey: string;
};

type SyntheticEntry = {
    call: string;
    line: number | undefined;
};

type SourceExtraction = {
    messages: SourceMessage[];
    output: string;
    project: CatalogProject;
    workDir: string;
};

type CatalogTemplateExtraction = {
    messages: SourceMessage[];
    output?: string | undefined;
    project: CatalogProject;
    shouldPreserveMetadataMessages: boolean;
};

type PluralVariant = {
    category: string;
    defaultValue: string;
    locations: SourceLocation[];
};

type PluralGroup = {
    baseKey: string;
    namespace: string;
    variants: PluralVariant[];
};

const CONTEXT_SEPARATOR = "\u{4}";
const DEFAULT_NAMESPACE = "translation";
const POTFILES_FILENAME = "POTFILES.in";
const SYNTHETIC_FILENAME = "messages.js";

const quietLogger = (): { logger: Logger; reports: string[] } => {
    const reports: string[] = [];

    return {
        reports,
        logger: {
            info() {
                return;
            },
            warn(message, more) {
                const detail = more === undefined ? "" : ` ${String(more)}`;
                reports.push(`${message}${detail}`);
            },
            error(message) {
                reports.push(String(message));
            },
        },
    };
};

const splitContext = (key: string): { context: string | null; msgid: string } => {
    const index = key.lastIndexOf(CONTEXT_SEPARATOR);

    if (index === -1) {
        return { context: null, msgid: key };
    }

    return { context: key.slice(index + CONTEXT_SEPARATOR.length), msgid: key.slice(0, index) };
};

const namespaceFor = (entry: ExtractedKey): string =>
    typeof entry.ns === "string" ? entry.ns : DEFAULT_NAMESPACE;

const validateIdentity = (context: string | null, msgid: string): void => {
    if (context === "" || msgid.length === 0) {
        throw new Error("Translation keys and contexts cannot be empty");
    }
};

const compareLocations = (left: SourceLocation, right: SourceLocation): number =>
    left.file.localeCompare(right.file) ||
    (left.line ?? 0) - (right.line ?? 0) ||
    (left.column ?? 0) - (right.column ?? 0);

const normalizedLocations = (locations: SourceLocation[]): SourceLocation[] => {
    const unique: Map<string, SourceLocation> = new Map();

    for (const location of locations) {
        const key = `${location.file}\0${String(location.line)}\0${String(location.column)}`;
        unique.set(key, location);
    }

    return unique.values().toArray().toSorted(compareLocations);
};

const pointSource = (entry: ExtractedKey, msgid: string): string => {
    if (typeof entry.defaultValue !== "string") {
        return msgid;
    }

    if (entry.explicitDefault === true) {
        return entry.defaultValue;
    }

    return entry.defaultValue === msgid || msgid.endsWith(`.${entry.defaultValue}`)
        ? msgid
        : entry.defaultValue;
};

const pointMessage = (entry: ExtractedKey): SourceMessage => {
    const { context, msgid } = splitContext(entry.key);
    validateIdentity(context, msgid);
    const singular = pointSource(entry, msgid);

    if (singular.length === 0) {
        throw new Error("Translation source strings cannot be empty");
    }

    return {
        context,
        locations: normalizedLocations(entry.locations ?? []),
        namespace: namespaceFor(entry),
        plural: null,
        singular,
        sourceKey: msgid,
    };
};

const expandedPlural = (entry: ExtractedKey): { baseKey: string; variant: PluralVariant } => {
    if (entry.isOrdinal === true) {
        throw new Error("GNU gettext catalogs do not support i18next ordinal plurals");
    }

    const suffix = /_(few|many|one|other|two|zero)$/u.exec(entry.key);
    const defaultValue = entry.defaultValue;
    const category = suffix?.[1];

    if (suffix === null || category === undefined || typeof defaultValue !== "string") {
        throw new Error("Unable to recover an i18next plural source pair");
    }

    return {
        baseKey: entry.key.slice(0, -suffix[0].length),
        variant: {
            category,
            defaultValue,
            locations: entry.locations ?? [],
        },
    };
};

const groupedPlurals = (entries: ExtractedKey[]): PluralGroup[] => {
    const groups: Map<string, PluralGroup> = new Map();

    for (const entry of entries) {
        const { baseKey, variant } = expandedPlural(entry);
        const namespace = namespaceFor(entry);
        const key = `${namespace}\0${baseKey}`;
        const group = groups.get(key) ?? { baseKey, namespace, variants: [] };
        group.variants.push(variant);
        groups.set(key, group);
    }

    return groups.values().toArray();
};

const pairedVariants = (variants: PluralVariant[]): { one: PluralVariant; other: PluralVariant } => {
    const categories = new Map(variants.map((variant) => [variant.category, variant]));

    if (categories.size !== 2 || !categories.has("one") || !categories.has("other")) {
        throw new Error("GNU gettext requires one singular and one plural source string");
    }

    const one = categories.get("one");
    const other = categories.get("other");

    if (one === undefined || other === undefined) {
        throw new Error("Unable to recover an i18next plural source pair");
    }

    return { one, other };
};

const pluralMessage = ({ baseKey, namespace, variants }: PluralGroup): SourceMessage => {
    const { one, other } = pairedVariants(variants);
    const { context, msgid } = splitContext(baseKey);
    validateIdentity(context, msgid);
    const singular = one.defaultValue;
    const plural = other.defaultValue;

    if (singular === plural || singular.length === 0 || plural.length === 0) {
        throw new Error("GNU gettext plural source strings must be distinct and non-empty");
    }

    return {
        context,
        locations: normalizedLocations(variants.flatMap((variant) => variant.locations)),
        namespace,
        plural,
        singular,
        sourceKey: msgid,
    };
};

const pluralMessages = (entries: ExtractedKey[]): SourceMessage[] =>
    groupedPlurals(entries).map((group) => pluralMessage(group));

const assertCardinal = (entry: ExtractedKey): void => {
    if (entry.isOrdinal === true) {
        throw new Error("GNU gettext catalogs do not support i18next ordinal plurals");
    }
};

const sourceMessages = (entries: ExtractedKey[]): SourceMessage[] => {
    const points: ExtractedKey[] = [];
    const plurals: ExtractedKey[] = [];

    for (const entry of entries) {
        assertCardinal(entry);

        if (entry.isExpandedPlural === true) {
            plurals.push(entry);
            continue;
        }

        if (entry.hasCount === true) {
            throw new Error("Count-based translations require an explicit plural source string");
        }

        points.push(entry);
    }

    return [...points.map((entry) => pointMessage(entry)), ...pluralMessages(plurals)];
};

const compareMessages = (left: SourceMessage, right: SourceMessage): number =>
    left.namespace.localeCompare(right.namespace) ||
    (left.context ?? "").localeCompare(right.context ?? "") ||
    left.singular.localeCompare(right.singular) ||
    (left.plural ?? "").localeCompare(right.plural ?? "");

const inferLocations = (message: SourceMessage, sources: Map<string, string>): SourceMessage => {
    if (message.locations.length > 0) {
        return message;
    }

    const locations: SourceLocation[] = [];

    for (const [file, source] of sources) {
        const index = source.indexOf(message.sourceKey);

        if (index !== -1) {
            locations.push({ file, line: source.slice(0, index).split("\n").length });
        }
    }

    return { ...message, locations };
};

const normalizedSourceFiles = (root: string, paths: string[]): string[] => {
    const files = paths
        .map((path) => resolve(root, path))
        .filter((path) => isPathWithin(root, path));

    return new Set(files).values().toArray().toSorted((left, right) => left.localeCompare(right));
};

const findSourceMessages = async (root: string, sourceFiles: string[]): Promise<SourceMessage[]> => {
    if (sourceFiles.length === 0) {
        clearI18nResources(root);

        return [];
    }

    let extracted: ExtractedKeysMap | undefined;
    const { logger, reports } = quietLogger();

    const capture: Plugin = {
        name: "gtkx-gettext",
        onEnd(keys) {
            extracted = keys;
        },
    };

    const result = await runExtractor(i18nToolkitConfig(root, sourceFiles, [capture]), {
        logger,
        quiet: true,
        syncPrimaryWithDefaults: true,
        trustDerivedDefaults: true,
    });

    if (extracted === undefined || reports.length > 0 || result.hasErrors) {
        throw new Error(reports.join("\n") || "i18next extraction failed");
    }

    const sources = new Map(sourceFiles.map((file) => [file, readFileSync(file, "utf8")]));

    return sourceMessages(extracted.values().toArray())
        .map((message) => inferLocations(message, sources))
        .toSorted(compareMessages);
};

const projectPath = (root: string, path: string): string | null => {
    const absolute = isAbsolute(path) ? resolve(path) : resolve(root, path);
    const projectRelative = relative(root, absolute);

    if (!isPathInside(root, absolute)) {
        return null;
    }

    return toPosixPath(projectRelative);
};

const writePotfiles = (project: CatalogProject, sourceFiles: string[]): string => {
    const paths = sourceFiles
        .map((path) => projectPath(project.root, path))
        .filter((path): path is string => path !== null);

    const sorted = [...new Set(paths)].toSorted((left, right) => left.localeCompare(right));
    const target = resolve(project.poDir, POTFILES_FILENAME);
    writeFileSync(target, sorted.length === 0 ? "" : `${sorted.join("\n")}\n`);

    return target;
};

const renderCatalogCall = (message: SourceMessage): string => {
    const msgid = JSON.stringify(message.singular);

    if (message.plural !== null) {
        const plural = JSON.stringify(message.plural);

        return message.context === null
            ? `ngettext(${msgid}, ${plural}, 0);`
            : `npgettext(${JSON.stringify(message.context)}, ${msgid}, ${plural}, 0);`;
    }

    return message.context === null
        ? `gettext(${msgid});`
        : `pgettext(${JSON.stringify(message.context)}, ${msgid});`;
};

const locatedOwners = (
    project: CatalogProject,
    message: SourceMessage,
): { path: string; line: number | undefined }[] => {
    const owners: { path: string; line: number | undefined }[] = [];

    for (const location of message.locations) {
        const path = projectPath(project.root, location.file);

        if (path !== null) {
            owners.push({ path, line: location.line });
        }
    }

    const unique = new Map(owners.map((owner) => [`${owner.path}\0${String(owner.line)}`, owner]));

    return unique.values().toArray();
};

const sourceOwners = (
    project: CatalogProject,
    message: SourceMessage,
): { path: string; line: number | undefined }[] => {
    const located = locatedOwners(project, message);

    return located.length > 0 ? located : [{ path: SYNTHETIC_FILENAME, line: undefined }];
};

const syntheticEntries = (
    project: CatalogProject,
    messages: SourceMessage[],
): Map<string, SyntheticEntry[]> => {
    const entries: Map<string, SyntheticEntry[]> = new Map();

    for (const message of messages) {
        for (const owner of sourceOwners(project, message)) {
            const owned = entries.get(owner.path) ?? [];
            owned.push({ call: renderCatalogCall(message), line: owner.line });
            entries.set(owner.path, owned);
        }
    }

    if (entries.size === 0) {
        entries.set(SYNTHETIC_FILENAME, []);
    }

    return entries;
};

const compareSyntheticEntries = (left: SyntheticEntry, right: SyntheticEntry): number =>
    (left.line ?? Number.MAX_SAFE_INTEGER) - (right.line ?? Number.MAX_SAFE_INTEGER);

const lastSyntheticLine = (entries: SyntheticEntry[]): number => {
    let line = 0;

    for (const entry of entries) {
        line = Math.max(line, entry.line ?? 0);
    }

    return line;
};

const appendSyntheticEntry = (lines: string[], entry: SyntheticEntry, requestedLine: number): void => {
    const index = requestedLine - 1;
    const existing = lines[index];

    if (existing === undefined || existing.length === 0) {
        lines[index] = entry.call;

        return;
    }

    lines[index] = `${existing} ${entry.call}`;
};

const renderSyntheticSource = (entries: SyntheticEntry[]): string => {
    const lines: string[] = [];
    const sorted = entries.toSorted(compareSyntheticEntries);
    let nextLine = lastSyntheticLine(entries) + 1;

    for (const entry of sorted) {
        const requestedLine = Math.max(1, entry.line ?? nextLine++);
        appendSyntheticEntry(lines, entry, requestedLine);
    }

    return `${lines.join("\n")}\n`;
};

const writeSyntheticSources = (
    workDir: string,
    project: CatalogProject,
    messages: SourceMessage[],
): string => {
    const entries = syntheticEntries(project, messages);
    const paths: string[] = [];

    for (const [path, owned] of entries) {
        const target = join(workDir, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, renderSyntheticSource(owned));
        paths.push(path);
    }

    const potfiles = join(workDir, POTFILES_FILENAME);
    writeFileSync(potfiles, `${paths.toSorted((left, right) => left.localeCompare(right)).join("\n")}\n`);

    return potfiles;
};

const extractSourceMessages = ({ project, messages, output, workDir }: SourceExtraction): void => {
    const potfilesPath = writeSyntheticSources(workDir, project, messages);

    runCliTool({
        tool: "xgettext",
        args: [
            "--language=JavaScript",
            "--from-code=UTF-8",
            "--force-po",
            "--keyword=gettext:1",
            "--keyword=ngettext:1,2",
            "--keyword=pgettext:1c,2",
            "--keyword=npgettext:1c,2,3",
            `--directory=${workDir}`,
            `--files-from=${potfilesPath}`,
            `--output=${output}`,
        ],
        target: output,
    });
};

const extractMetadataFragment = (project: CatalogProject, input: string, output: string): void => {
    runCliTool({
        tool: "msggrep",
        args: [
            "--force-po",
            `--output-file=${output}`,
            ...metadataTemplateFiles(project).map((file) => `--location=${file.relativePath}`),
            input,
        ],
        target: input,
    });
};

const joinMetadataFragment = (output: string, fragment: string): void => {
    runCliTool({
        tool: "xgettext",
        args: ["--language=PO", "--join-existing", "--force-po", `--output=${output}`, fragment],
        target: output,
    });
};

const extractCatalogTemplate = ({
    project,
    messages,
    shouldPreserveMetadataMessages,
    output = resolve(project.poDir, `${project.domain}.pot`),
}: CatalogTemplateExtraction): void => {
    const workDir = mkdtempSync(join(project.poDir, ".gtkx-i18n-"));
    const source = join(workDir, "source.pot");
    const hasPreviousTemplate = existsSync(output);

    try {
        if (shouldPreserveMetadataMessages && hasPreviousTemplate) {
            const fragment = join(workDir, "metadata.pot");
            extractMetadataFragment(project, output, fragment);
            extractSourceMessages({ project, messages, output: source, workDir });
            joinMetadataFragment(source, fragment);
        } else {
            extractSourceMessages({ project, messages, output: source, workDir });
        }

        replaceCatalogTemplate(source, output);
    } finally {
        rmSync(workDir, { recursive: true, force: true });
    }
};

const extractSourceCatalogTo = async (
    project: CatalogProject,
    paths: string[],
    output: string,
): Promise<void> => {
    const sourceFiles = normalizedSourceFiles(project.root, paths);
    const messages = await findSourceMessages(project.root, sourceFiles);
    writePotfiles(project, sourceFiles);
    extractCatalogTemplate({ project, messages, shouldPreserveMetadataMessages: false, output });
};

const extractSourceCatalog = async (
    project: CatalogProject,
    paths: string[],
    shouldPreserveMetadataMessages = true,
): Promise<void> => {
    const sourceFiles = normalizedSourceFiles(project.root, paths);
    const messages = await findSourceMessages(project.root, sourceFiles);
    writePotfiles(project, sourceFiles);
    extractCatalogTemplate({ project, messages, shouldPreserveMetadataMessages });
};

export { extractSourceCatalog, extractSourceCatalogTo };
