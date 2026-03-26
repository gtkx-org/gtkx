import { copyFileSync, existsSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { GirRepository } from "@gtkx/gir";
import { defineCommand } from "citty";
import { intro, log, outro } from "../core/utils/progress.js";
import { GIRS_DIR, SYSTEM_GIRS_DIR } from "./constants.js";

/** Root namespace keys whose transitive dependencies form the full GIR set. */
const ROOTS = ["Gtk-4.0", "Adw-1", "GES-1.0", "GtkSource-5", "Vte-3.91", "WebKit-6.0"];

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

        const graph = await GirRepository.discoverDependencies(ROOTS, {
            girPath: [SYSTEM_GIRS_DIR],
        });

        log.info(`Discovered ${graph.size} GIR files from roots: ${ROOTS.join(", ")}`);

        for (const [key, { filePath }] of graph) {
            copyFileSync(filePath, join(GIRS_DIR, `${key}.gir`));
        }

        outro(`Synced ${graph.size} GIR files to ${GIRS_DIR}`);
    },
});
