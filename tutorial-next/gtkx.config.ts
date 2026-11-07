import { defineConfig } from "@gtkx/config";

export default defineConfig({
    libraries: ["GtkSource-5"],
    applicationId: "dev.gtkx.Notes",
    applicationIcon: "data/icons",
    deploy: {
        name: "Notes",
        genericName: "Markdown Notes",
        binaryName: "gtkx-notes",
        summary: "Write Markdown notes kept as plain files",
        description: [
            "Notes keeps each note as a Markdown file in a folder, so notes sync with any tool and outlive the app.",
            "It previews Markdown, searches the full text, filters by tag, completes links to other notes, " +
                "and shows changes made by other editors or sync tools as they happen.",
        ],
        categories: ["Utility", "TextEditor"],
        keywords: ["Notes", "Markdown", "Notebook", "Writing"],
        developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
        homepage: "https://gtkx.dev",
        urls: {
            bugtracker: "https://github.com/gtkx-org/gtkx/issues",
            "vcs-browser": "https://github.com/gtkx-org/gtkx",
        },
        screenshots: [
            { file: "assets/screenshot.png", caption: "Reading a note as rendered Markdown", isDefault: true },
            { file: "assets/screenshot-editor.png", caption: "Writing Markdown with syntax highlighting" },
        ],
        releases: [{ version: "1.0.0", date: "2026-11-07", notes: ["Initial release."] }],
        branding: { light: "#f8e45c", dark: "#865e3c" },
        contentRating: {},
        isDbusActivatable: true,
        screenshotBaseUrl: "https://raw.githubusercontent.com/gtkx-org/gtkx/main/tutorial",
        targets: ["flatpak", "deb", "rpm", "appimage"],
        flatpak: {
            finishArgs: ["--filesystem=xdg-documents/Notes:create"],
        },
    },
});
