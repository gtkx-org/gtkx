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
    "Not one of the libraries below is included in this package. GTKX reaches them through GObject",
    "introspection, so they are resolved when the application runs: from the host system for a deb, an rpm",
    "or an AppImage, and from the GNOME runtime for a flatpak. Your platform distributes them to you under",
    "their own terms; this package does not distribute them at all.",
    "The GTKX native addon does link GLib, GObject and GIO dynamically against the copies already installed",
    "on the system, which makes the addon a work that uses those libraries, and section 6 of the LGPL asks",
    "such a work to carry a notice, the license, and the copyright notices. This is the notice it asks for,",
    "and the license itself is published at",
    `${LGPL_URL},`,
    "and the copyright notice of each library is published with its sources, at the address listed beside",
    "it below. Linking against an installed shared library is the mechanism section 6(b) allows, so the",
    "source of the libraries does not have to travel with this package.",
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
