import { readdirSync } from "node:fs";
import type { Config } from "@gtkx/config";
import { GIR_LIBRARY_PATTERN, LIBRARIES_WILDCARD } from "@gtkx/config/internal";
import { sortStrings } from "@gtkx/utils";

const DEFAULT_LIBRARIES: string[] = ["Gtk-4.0"];

const GIR_FILE_SUFFIX = ".gir";

export const resolveLibraries = (libraries: Config["libraries"], girPath: string[]): string[] => {
    if (libraries === undefined) {
        return [...DEFAULT_LIBRARIES];
    }

    if (libraries === LIBRARIES_WILDCARD) {
        const discovered = discoverGirNamespaces(girPath);
        if (discovered.length === 0) {
            throw new Error(
                `gtkx.config.ts: \`libraries: "*"\` matched no .gir files in [${girPath.join(", ")}]. ` +
                    "Install gobject-introspection data packages, or list the libraries explicitly.",
            );
        }
        return discovered;
    }

    const hasGtk = libraries.some((library) => library.startsWith("Gtk-"));
    return [...new Set([...(hasGtk ? [] : DEFAULT_LIBRARIES), ...libraries])];
};

type GirNamespace = { name: string; version: string; identifier: string };

const readDirEntries = (dir: string): string[] => {
    try {
        return readdirSync(dir);
    } catch {
        return [];
    }
};

const parseGirNamespace = (entry: string): GirNamespace | undefined => {
    if (!entry.endsWith(GIR_FILE_SUFFIX)) {
        return undefined;
    }

    const identifier = entry.slice(0, -GIR_FILE_SUFFIX.length);
    if (!GIR_LIBRARY_PATTERN.test(identifier)) {
        return undefined;
    }

    const separator = identifier.indexOf("-");
    return { name: identifier.slice(0, separator), version: identifier.slice(separator + 1), identifier };
};

const recordHighest = (highestByName: Map<string, GirNamespace>, parsed: GirNamespace): void => {
    const existing = highestByName.get(parsed.name);
    if (existing === undefined || compareVersions(parsed.version, existing.version) > 0) {
        highestByName.set(parsed.name, parsed);
    }
};

export const discoverGirNamespaces = (girPath: string[]): string[] => {
    const highestByName = new Map<string, GirNamespace>();

    for (const dir of girPath) {
        for (const entry of readDirEntries(dir)) {
            const parsed = parseGirNamespace(entry);
            if (parsed !== undefined) {
                recordHighest(highestByName, parsed);
            }
        }
    }

    return sortStrings([...highestByName.values()].map(({ identifier }) => identifier));
};

const compareVersions = (a: string, b: string): number => {
    const aParts = a.split(".");
    const bParts = b.split(".");
    const length = Math.max(aParts.length, bParts.length);

    for (let index = 0; index < length; index += 1) {
        const difference = Number(aParts[index] ?? 0) - Number(bParts[index] ?? 0);
        if (difference !== 0) {
            return difference;
        }
    }

    return 0;
};
