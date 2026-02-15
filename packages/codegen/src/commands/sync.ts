import { copyFileSync, existsSync, mkdirSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { defineCommand } from "citty";
import { intro, log, outro } from "../core/utils/progress.js";
import { GIRS_DIR, SYSTEM_GIRS_DIR } from "./constants.js";

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

        for (const file of files) {
            copyFileSync(join(SYSTEM_GIRS_DIR, file), join(GIRS_DIR, file));
        }

        outro(`Synced ${files.length} GIR files to ${GIRS_DIR}`);
    },
});
