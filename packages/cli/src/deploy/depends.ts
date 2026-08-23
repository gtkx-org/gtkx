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

const GLES_SONAME = "libGLESv2.so.2()(64bit)";
const NO_EXTRA: Relations = { deb: [], rpm: [] };

const BASE_DEPENDS: Relations = {
    deb: ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"],
    rpm: ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"],
};

const DEPENDS_BY_LIBRARY: Record<string, LibraryPackages> = {
    "Adw-1": { deb: "libadwaita-1-0", rpm: "libadwaita", extra: NO_EXTRA },
    "Gtk-4.0": { deb: "libgtk-4-1", rpm: "gtk4", extra: { deb: [], rpm: [GLES_SONAME] } },
    "GtkSource-5": { deb: "libgtksourceview-5-0", rpm: "gtksourceview5", extra: NO_EXTRA },
    "WebKit-6.0": { deb: "libwebkitgtk-6.0-4", rpm: "webkitgtk6.0", extra: NO_EXTRA },
};

const PACKAGED_LIBRARIES: string[] = Object.keys(DEPENDS_BY_LIBRARY);

const debRelation = (name: string, floor: string | undefined): string =>
    floor === undefined ? name : `${name} (>= ${floor})`;

const rpmRelation = (name: string, floor: string | undefined): string =>
    floor === undefined ? name : `${name} >= ${floor}`;

const libraryDepends = (settings: DeploySettings): Relations => {
    const deb: string[] = [];
    const rpm: string[] = [];

    for (const library of settings.libraries) {
        const packages = DEPENDS_BY_LIBRARY[library];

        if (packages === undefined) {
            continue;
        }

        const floor = settings.libraryFloors[library];
        deb.push(debRelation(packages.deb, floor), ...packages.extra.deb);
        rpm.push(rpmRelation(packages.rpm, floor), ...packages.extra.rpm);
    }

    return { deb, rpm };
};

const glibcDepends = (glibcFloor: string | null): Relations =>
    glibcFloor === null
        ? { deb: [], rpm: [] }
        : { deb: [debRelation("libc6", glibcFloor)], rpm: [rpmRelation("glibc", glibcFloor)] };

const dedupe = (entries: string[]): string[] => [...new Set(entries)];

const resolveDepends = (settings: DeploySettings, glibcFloor: string | null): Relations => {
    const fromLibraries = libraryDepends(settings);
    const fromGlibc = glibcDepends(glibcFloor);
    const extra = settings.deploy.depends ?? {};

    return {
        deb: dedupe([...fromLibraries.deb, ...BASE_DEPENDS.deb, ...fromGlibc.deb, ...(extra.deb ?? [])]),
        rpm: dedupe([...fromLibraries.rpm, ...BASE_DEPENDS.rpm, ...fromGlibc.rpm, ...(extra.rpm ?? [])]),
    };
};

export { PACKAGED_LIBRARIES, resolveDepends };
