import { sortStringsBy } from "@gtkx/utils";
import type { DeploySettings, Notice, NoticeSection } from "../types.js";

type PlatformLibrary = {
    subject: string;
    license: string;
    source: string;
};

const TITLE = "Platform libraries";
const GNOME_URL = "https://gitlab.gnome.org/GNOME";
const LGPL = "LGPL-2.1-or-later";
const LGPL_URL = "https://www.gnu.org/licenses/old-licenses/lgpl-2.1.html";

const GLIB: PlatformLibrary = {
    subject: "GLib, GObject and GIO",
    license: LGPL,
    source: `${GNOME_URL}/glib`,
};

const KNOWN_LIBRARIES: Record<string, PlatformLibrary> = {
    "Adw-1": { subject: "libadwaita", license: LGPL, source: `${GNOME_URL}/libadwaita` },
    "Gtk-4.0": { subject: "GTK", license: LGPL, source: `${GNOME_URL}/gtk` },
    "GtkSource-5": { subject: "GtkSourceView", license: LGPL, source: `${GNOME_URL}/gtksourceview` },
    "WebKit-6.0": {
        subject: "WebKitGTK",
        license: "LGPL-2.1-or-later and BSD-2-Clause",
        source: "https://github.com/WebKit/WebKit",
    },
};

const SUMMARY = [
    "GTKX loads these native libraries through generated FFI bindings. Debian, RPM and AppImage",
    "deployments use the host's libraries; Flatpak uses its configured runtime. GTKX does not bundle",
    "these platform dependencies. Its native addon also links dynamically to GLib, GObject and GIO.",
    "The sources and license identifiers are listed below. Copyright notices accompany each library's",
    `sources. The LGPL 2.1 text is available at ${LGPL_URL}.`,
];

const noticeFor = (library: PlatformLibrary): Notice => ({
    subject: library.subject,
    license: library.license,
    source: library.source,
    copyright: [],
    text: null,
});

const knownLibraries = (settings: DeploySettings): PlatformLibrary[] =>
    settings.libraries.map((library) => KNOWN_LIBRARIES[library]).filter((library) => library !== undefined);

const otherLibraries = (settings: DeploySettings): string[] =>
    settings.libraries.filter((library) => KNOWN_LIBRARIES[library] === undefined);

const otherSummary = (settings: DeploySettings): string[] => {
    const others = otherLibraries(settings);

    if (others.length === 0) {
        return [];
    }

    return [`This application also declares ${others.join(", ")}, resolved from the platform the same way.`];
};

const libraryNotices = (settings: DeploySettings): NoticeSection => {
    const libraries = sortStringsBy(knownLibraries(settings), (library) => library.subject);

    return {
        title: TITLE,
        files: [],
        summary: [...SUMMARY, ...otherSummary(settings)],
        notices: [GLIB, ...libraries].map((library) => noticeFor(library)),
    };
};

export { libraryNotices };
