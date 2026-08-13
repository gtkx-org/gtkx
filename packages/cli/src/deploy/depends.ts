import type { DeployConfig } from "./types.js";

type Relations = {
    deb: string[];
    rpm: string[];
};

const GLES_SONAME = "libGLESv2.so.2()(64bit)";

const BASE_DEPENDS: Relations = {
    deb: ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"],
    rpm: ["hicolor-icon-theme", "adwaita-icon-theme", "gsettings-desktop-schemas"],
};

const DEPENDS_BY_LIBRARY: Record<string, Relations> = {
    "Adw-1": { deb: ["libadwaita-1-0"], rpm: ["libadwaita"] },
    "Gtk-4.0": { deb: ["libgtk-4-1"], rpm: ["gtk4", GLES_SONAME] },
    "GtkSource-5": { deb: ["libgtksourceview-5-0"], rpm: ["gtksourceview5"] },
    "WebKit-6.0": { deb: ["libwebkitgtk-6.0-4"], rpm: ["webkitgtk6.0"] },
};

const libraryDepends = (libraries: string[]): Relations => ({
    deb: libraries.flatMap((library) => DEPENDS_BY_LIBRARY[library]?.deb ?? []),
    rpm: libraries.flatMap((library) => DEPENDS_BY_LIBRARY[library]?.rpm ?? []),
});

const glibcDepends = (glibcFloor: string | null): Relations =>
    glibcFloor === null ? { deb: [], rpm: [] } : { deb: [`libc6 (>= ${glibcFloor})`], rpm: [`glibc >= ${glibcFloor}`] };

const dedupe = (entries: string[]): string[] => [...new Set(entries)];

const resolveDepends = (deploy: DeployConfig, libraries: string[], glibcFloor: string | null): Relations => {
    const fromLibraries = libraryDepends(libraries);
    const fromGlibc = glibcDepends(glibcFloor);

    return {
        deb: dedupe([...fromLibraries.deb, ...BASE_DEPENDS.deb, ...fromGlibc.deb, ...(deploy.depends?.deb ?? [])]),
        rpm: dedupe([...fromLibraries.rpm, ...BASE_DEPENDS.rpm, ...fromGlibc.rpm, ...(deploy.depends?.rpm ?? [])]),
    };
};

export { resolveDepends };
