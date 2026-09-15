import { fileSetContents, getUserDataDir } from "@gtkx/gi/glib";
import type { StateStorage } from "zustand/middleware";
import { mkdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";

const directory = join(getUserDataDir(), "com.gtkx.tutorial");
const file = join(directory, "tasks.json");

export const fileStorage: StateStorage = {
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
