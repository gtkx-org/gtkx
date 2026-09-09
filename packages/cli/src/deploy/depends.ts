import type { DeploySettings } from "./types.js";
import { PACKAGED_SONAMES, type PackagedSoname } from "./node-runtime/sonames.js";

type Relations = {
    deb: string[];
    rpm: string[];
};

type PackageNames = {
    deb: string;
    rpm: string;
};

type LibraryPackages = PackageNames & {
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

const RUNTIME_PACKAGES: Record<PackagedSoname, PackageNames> = {
    "libatomic.so.1": { deb: "libatomic1", rpm: `libatomic.so.1${SONAME_SUFFIX}` },
    "libgcc_s.so.1": { deb: "libgcc-s1", rpm: `libgcc_s.so.1${SONAME_SUFFIX}` },
    "libstdc++.so.6": { deb: "libstdc++6", rpm: `libstdc++.so.6${SONAME_SUFFIX}` },
};

const RUNTIME_DEPENDS: Relations = {
    deb: PACKAGED_SONAMES.map((soname) => RUNTIME_PACKAGES[soname].deb),
    rpm: PACKAGED_SONAMES.map((soname) => RUNTIME_PACKAGES[soname].rpm),
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
        deb: dedupe([
            ...fromLibraries.deb,
            ...BASE_DEPENDS.deb,
            ...fromGlibc.deb,
            ...RUNTIME_DEPENDS.deb,
            ...(extra.deb ?? []),
        ]),
        rpm: dedupe([
            ...fromLibraries.rpm,
            ...BASE_DEPENDS.rpm,
            ...fromGlibc.rpm,
            ...RUNTIME_DEPENDS.rpm,
            ...(extra.rpm ?? []),
        ]),
    };
};

export { resolveDepends };
