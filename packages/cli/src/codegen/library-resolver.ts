import { readdirSync } from "node:fs";
import { GIR_NAMESPACE_PATTERN, type GtkxConfig, LIBRARIES_WILDCARD } from "@gtkx/config";

/**
 * GIR namespaces generated when `gtkx.config.ts` omits `libraries`.
 *
 * Only GTK 4 is mandatory: `@gtkx/react` is namespace-agnostic, so optional
 * namespaces (libadwaita, GtkSource, WebKit, …) are generated exactly when a
 * project lists them. GTK's transitive dependencies (GLib, GObject, Gio, Gdk,
 * Pango, Cairo, …) are resolved automatically from the GIR files on disk. An
 * explicit `libraries` list replaces this default; `Gtk-4.0` is added when
 * the list omits it, since the reconciler's widget handling requires it.
 */
const DEFAULT_LIBRARIES: readonly string[] = ["Gtk-4.0"];

const GIR_FILE_SUFFIX = ".gir";

/**
 * Resolves the {@link GtkxConfig.libraries} setting to a concrete list of
 * `Name-Version` GIR namespace identifiers:
 *
 * - omitted → {@link DEFAULT_LIBRARIES}
 * - `"*"` → every `.gir` discovered across `girPath`, keeping the newest
 *   version of each namespace
 * - an explicit array → as given, with `Gtk-4.0` added when omitted
 *
 * @param libraries - The validated `libraries` field from {@link GtkxConfig}
 * @param girPath - Resolved GIR search directories, used only to expand `"*"`
 * @returns Concrete GIR namespace identifiers
 * @throws When `libraries` is `"*"` and no `.gir` files are found on `girPath`
 */
export const resolveLibraries = (libraries: GtkxConfig["libraries"], girPath: readonly string[]): string[] => {
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

/**
 * Scans every directory in `girPath` for `Name-Version.gir` files and returns
 * their namespace identifiers, sorted. When several versions of the same
 * namespace are present, only the highest is kept — a single codegen run
 * cannot emit two bindings for the same namespace.
 *
 * Files whose names do not match {@link GIR_NAMESPACE_PATTERN} are skipped, as
 * are directories that cannot be read.
 *
 * @param girPath - Resolved GIR search directories
 * @returns Sorted GIR namespace identifiers, one per namespace
 */
const discoverGirNamespaces = (girPath: readonly string[]): string[] => {
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

    return [...highestByName.values()].map(({ identifier }) => identifier).sort((a, b) => a.localeCompare(b));
};

/**
 * Compares two dot-separated numeric version strings component-wise.
 *
 * @param a - First version string, e.g. `"4.0"`
 * @param b - Second version string, e.g. `"3.0"`
 * @returns A positive number when `a` is newer, negative when `b` is newer,
 *     and `0` when they are equal
 */
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
