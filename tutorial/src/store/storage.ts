import type { StateStorage } from "zustand/middleware";
import { fileSetContents, getUserDataDir } from "@gtkx/gi/glib";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { applicationId } from "virtual:gtkx-config";

const directory = join(getUserDataDir(), applicationId);
const file = join(directory, "tasks.json");

const fileStorage: StateStorage = {
    getItem: () => {
        try {
            return readFileSync(file, "utf8");
        } catch (error) {
            if (error instanceof Error && "code" in error && error.code === "ENOENT") {
                return null;
            }

            throw error;
        }
    },
    setItem: (_name, value) => {
        mkdirSync(directory, { recursive: true });
        fileSetContents(file, Buffer.from(value));
    },
    removeItem: () => {
        rmSync(file, { force: true });
    },
};

export {
    fileStorage,
};
