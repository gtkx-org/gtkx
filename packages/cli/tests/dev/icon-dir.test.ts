import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { prepareDevIconDir } from "../../src/dev/icon-dir.js";

const DATA_DIR = "data";

describe("prepareDevIconDir", () => {
    let projectDir: string;
    let savedXdgDataDirs: string | undefined;

    const writeIcon = (relPath: string): void => {
        const full = join(projectDir, relPath);
        mkdirSync(join(full, ".."), { recursive: true });
        writeFileSync(full, "<svg/>");
    };

    beforeEach(() => {
        projectDir = mkdtempSync(join(tmpdir(), "gtkx-icon-dir-test-"));
        savedXdgDataDirs = process.env.XDG_DATA_DIRS;
        delete process.env.XDG_DATA_DIRS;
    });

    afterEach(() => {
        rmSync(projectDir, { recursive: true, force: true });

        if (savedXdgDataDirs === undefined) delete process.env.XDG_DATA_DIRS;
        else process.env.XDG_DATA_DIRS = savedXdgDataDirs;
    });

    it("returns null and leaves the environment alone without an icons directory", () => {
        const dir = prepareDevIconDir(projectDir, DATA_DIR);
        expect(dir).toBeNull();
        expect(process.env.XDG_DATA_DIRS).toBeUndefined();
    });

    it("returns null when there is no data directory", () => {
        const dir = prepareDevIconDir(projectDir, null);
        expect(dir).toBeNull();
        expect(process.env.XDG_DATA_DIRS).toBeUndefined();
    });

    it("exports the data directory with the spec default appended when XDG_DATA_DIRS is unset", () => {
        writeIcon(join(DATA_DIR, "icons", "hicolor", "scalable", "apps", "com.example.app.svg"));
        const dir = prepareDevIconDir(projectDir, DATA_DIR);
        expect(dir).toBe(join(projectDir, DATA_DIR));
        expect(process.env.XDG_DATA_DIRS).toBe(`${dir}:/usr/local/share:/usr/share`);
    });

    it("prepends to an existing XDG_DATA_DIRS", () => {
        writeIcon(join(DATA_DIR, "icons", "hicolor", "scalable", "apps", "com.example.app.svg"));
        process.env.XDG_DATA_DIRS = "/app/share:/usr/share";
        const dir = prepareDevIconDir(projectDir, DATA_DIR);
        expect(process.env.XDG_DATA_DIRS).toBe(`${dir}:/app/share:/usr/share`);
    });

    it("does not duplicate an already exported data directory", () => {
        writeIcon(join(DATA_DIR, "icons", "hicolor", "scalable", "apps", "com.example.app.svg"));
        const first = prepareDevIconDir(projectDir, DATA_DIR);
        const before = process.env.XDG_DATA_DIRS;
        const second = prepareDevIconDir(projectDir, DATA_DIR);
        expect(second).toBe(first);
        expect(process.env.XDG_DATA_DIRS).toBe(before);
    });
});
