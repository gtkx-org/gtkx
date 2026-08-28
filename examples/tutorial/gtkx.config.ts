import { defineConfig } from "@gtkx/config";

export default defineConfig({
    applicationId: "com.gtkx.tutorial",
    applicationIcon: "data/icons",
    future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
        v2DefaultLibraries: true,
        v2TreeShaking: true,
    },
    deploy: {
        name: "Tasks",
        genericName: "Task Manager",
        binaryName: "gtkx-tutorial",
        summary: "Manage your tasks and to-dos",
        description: [
            "A task manager built with GTKX, demonstrating how to build React-based GTK4 and Adwaita "
            + "desktop applications.",
            "It shows an adaptive sidebar layout, boxed lists, a task editor, GSettings-backed preferences, "
            + "undo toasts, drag-to-reorder, desktop notifications, and local JSON persistence.",
        ],
        categories: ["Office", "ProjectManagement"],
        keywords: ["Task", "Tasks", "Todo", "To-do", "Checklist"],
        developer: { id: "dev.gtkx", name: "GTKX", email: "hello@gtkx.dev" },
        homepage: "https://gtkx.dev",
        urls: {
            bugtracker: "https://github.com/gtkx-org/gtkx/issues",
            "vcs-browser": "https://github.com/gtkx-org/gtkx",
        },
        screenshots: [
            { file: "assets/screenshot.png", caption: "Browsing task lists in the sidebar", isDefault: true },
            { file: "assets/screenshot-editor.png", caption: "Editing a task" },
        ],
        releases: [{ version: "1.0.0", date: "2026-07-13", notes: ["Initial release."] }],
        branding: { light: "#3584e4", dark: "#1a5fb4" },
        contentRating: {},
        isDbusActivatable: true,
        desktopEntry: { "X-GNOME-UsesNotifications": "true" },
        screenshotBaseUrl: "https://raw.githubusercontent.com/gtkx-org/gtkx/main/examples/tutorial",
        targets: ["flatpak", "deb", "rpm", "appimage"],
    },
});
