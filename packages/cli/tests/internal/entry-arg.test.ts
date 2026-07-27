import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { resolveEntry } from "../../src/internal/entry-arg.js";

describe("resolveEntry", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-entry-"));
        mkdirSync(join(cwd, "src"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    const seed = (relativePath: string): void => {
        writeFileSync(join(cwd, relativePath), "");
    };

    it("resolves an explicitly supplied entry against the cwd", () => {
        const { entry } = resolveEntry({ entry: "src/main.jsx", cwd });
        expect(entry).toBe(join(cwd, "src/main.jsx"));
    });

    it("prefers src/index.tsx over the other extensions", () => {
        seed("src/index.js");
        seed("src/index.jsx");
        seed("src/index.tsx");
        const { entry } = resolveEntry({ cwd });
        expect(entry).toBe(join(cwd, "src/index.tsx"));
    });

    it("detects a JavaScript entry when no TypeScript entry exists", () => {
        seed("src/index.jsx");
        const { entry } = resolveEntry({ cwd });
        expect(entry).toBe(join(cwd, "src/index.jsx"));
    });

    it("falls back to src/index.tsx when no entry file exists", () => {
        const { entry } = resolveEntry({ cwd });
        expect(entry).toBe(join(cwd, "src/index.tsx"));
    });
});
