import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { intro, log, outro } from "../core/utils/progress.js";
import { GIRS_DIR, SYSTEM_GIRS_DIR } from "./constants.js";

const GIRS_TO_SYNC = new Set([
    "Adw-1.gir",
    "AppStream-1.0.gir",
    "Atspi-2.0.gir",
    "GLib-2.0.gir",
    "GLibUnix-2.0.gir",
    "GModule-2.0.gir",
    "GObject-2.0.gir",
    "Gdk-4.0.gir",
    "GdkPixbuf-2.0.gir",
    "Gio-2.0.gir",
    "GioUnix-2.0.gir",
    "Graphene-1.0.gir",
    "Gsk-4.0.gir",
    "Gst-1.0.gir",
    "GstBase-1.0.gir",
    "Gtk-4.0.gir",
    "GtkSource-5.gir",
    "HarfBuzz-0.0.gir",
    "JavaScriptCore-6.0.gir",
    "Json-1.0.gir",
    "Pango-1.0.gir",
    "PangoCairo-1.0.gir",
    "Secret-1.gir",
    "Soup-3.0.gir",
    "Vte-3.91.gir",
    "WebKit-6.0.gir",
    "WebKitWebProcessExtension-6.0.gir",
    "cairo-1.0.gir",
    "freetype2-2.0.gir",
    "libxml2-2.0.gir",
]);

export { GIRS_TO_SYNC };

export const sync = defineCommand({
    meta: {
        name: "sync",
        description: "Sync GIR files from system to workspace",
    },
    run: async () => {
        intro("Syncing GIR files");

        if (!existsSync(GIRS_DIR)) {
            mkdirSync(GIRS_DIR, { recursive: true });
            log.info(`Created directory: ${GIRS_DIR}`);
        }

        const files = readdirSync(SYSTEM_GIRS_DIR).filter((f) => f.endsWith(".gir"));
        log.info(`Found ${files.length} GIR files in ${SYSTEM_GIRS_DIR}`);

        let syncedCount = 0;
        for (const file of files) {
            if (!GIRS_TO_SYNC.has(file)) continue;
            copyFileSync(join(SYSTEM_GIRS_DIR, file), join(GIRS_DIR, file));
            syncedCount++;
        }

        outro(`Synced ${syncedCount} GIR files to ${GIRS_DIR}`);
    },
});
