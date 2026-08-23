import type { DeploySettings } from "./types.js";

type Relations = {
    deb: string[];
    rpm: string[];
};

type LibraryPackages = {
    deb: string;
    rpm: string;
    extra: Relations;
};

const SONAME_SUFFIX = "()(64bit)";
const GLES_SONAME = `libGLESv2.so.2${SONAME_SUFFIX}`;
const NO_EXTRA: Relations = { deb: [], rpm: [] };

const BASE_DEPENDS: Relations = {
    deb: ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"],
    rpm: ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"],
};

const DEPENDS_BY_LIBRARY: Record<string, LibraryPackages> = {
    "Adw-1": { deb: "libadwaita-1-0", rpm: "libadwaita", extra: NO_EXTRA },
    "Gtk-4.0": { deb: "libgtk-4-1", rpm: "gtk4", extra: { deb: [], rpm: [GLES_SONAME] } },
};

const debRelation = (name: string, minimum: string | undefined): string =>
    minimum === undefined ? name : `${name} (>= ${minimum})`;

const rpmRelation = (name: string, minimum: string | undefined): string =>
    minimum === undefined ? name : `${name} >= ${minimum}`;

const libraryDepends = (settings: DeploySettings): Relations => {
    const deb: string[] = [];
    const rpm: string[] = [];

    for (const library of settings.libraries) {
        const packages = DEPENDS_BY_LIBRARY[library];

        if (packages === undefined) {
            continue;
        }

        const minimum = settings.minimumLibraryVersions[library];
        deb.push(debRelation(packages.deb, minimum), ...packages.extra.deb);
        rpm.push(rpmRelation(packages.rpm, minimum), ...packages.extra.rpm);
    }

    return { deb, rpm };
};

const glibcDepends = (glibcMinimum: string | null): Relations =>
    glibcMinimum === null
        ? { deb: [], rpm: [] }
        : { deb: [debRelation("libc6", glibcMinimum)], rpm: [rpmRelation("glibc", glibcMinimum)] };

const dedupe = (entries: string[]): string[] => [...new Set(entries)];

const resolveDepends = (settings: DeploySettings, glibcMinimum: string | null): Relations => {
    const fromLibraries = libraryDepends(settings);
    const fromGlibc = glibcDepends(glibcMinimum);
    const extra = settings.deploy.depends ?? {};

    return {
        deb: dedupe([...fromLibraries.deb, ...BASE_DEPENDS.deb, ...fromGlibc.deb, ...(extra.deb ?? [])]),
        rpm: dedupe([...fromLibraries.rpm, ...BASE_DEPENDS.rpm, ...fromGlibc.rpm, ...(extra.rpm ?? [])]),
    };
};

export { resolveDepends };
