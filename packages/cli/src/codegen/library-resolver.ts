import { readdirSync } from "node:fs";
import { GIR_NAMESPACE_PATTERN, type GtkxConfig, LIBRARIES_WILDCARD } from "@gtkx/config";
import { sortedAlpha } from "@gtkx/utils";
import { GtkxError } from "../internal/errors.js";

const DEFAULT_LIBRARIES: string[] = ["Gtk-4.0"];

const GIR_FILE_SUFFIX = ".gir";

export const resolveLibraries = (libraries: GtkxConfig["libraries"], girPath: string[]): string[] => {
    if (libraries === undefined) {
        return [...DEFAULT_LIBRARIES];
    }

    if (libraries === LIBRARIES_WILDCARD) {
        const discovered = discoverGirNamespaces(girPath);
        if (discovered.length === 0) {
            throw new GtkxError(
                `gtkx.config.ts: \`libraries: "*"\` matched no .gir files in [${girPath.join(", ")}]. ` +
                    "Install gobject-introspection data packages, or list the libraries explicitly.",
            );
        }
        return discovered;
    }

    const hasGtk = libraries.some((library) => library.startsWith("Gtk-"));
    return [...new Set([...(hasGtk ? [] : DEFAULT_LIBRARIES), ...libraries])];
};

const discoverGirNamespaces = (girPath: string[]): string[] => {
    const highestByName = new Map<string, { version: string; identifier: string }>();

    for (const dir of girPath) {
        let entries: string[];
        try {
            entries = readdirSync(dir);
        } catch {
            continue;
        }

        for (const entry of entries) {
            if (!entry.endsWith(GIR_FILE_SUFFIX)) {
                continue;
            }

            const identifier = entry.slice(0, -GIR_FILE_SUFFIX.length);
            if (!GIR_NAMESPACE_PATTERN.test(identifier)) {
                continue;
            }

            const separator = identifier.indexOf("-");
            const name = identifier.slice(0, separator);
            const version = identifier.slice(separator + 1);
            const existing = highestByName.get(name);
            if (existing === undefined || compareVersions(version, existing.version) > 0) {
                highestByName.set(name, { version, identifier });
            }
        }
    }

    return sortedAlpha([...highestByName.values()].map(({ identifier }) => identifier));
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
