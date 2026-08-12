import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { resolveEntry } from "../../src/internal/entry-arg.js";
import { setupTempProject } from "../temp-project.js";

describe("resolveEntry", () => {
    const project = setupTempProject("gtkx-entry-");

    const seed = (relativePath: string): void => {
        writeFileSync(join(project.path, relativePath), "");
    };

    it("resolves an explicitly supplied entry against the cwd", () => {
        expect(resolveEntry(project.path, "src/main.jsx")).toBe(join(project.path, "src/main.jsx"));
    });

    it("prefers src/index.tsx over the other extensions", () => {
        seed("src/index.js");
        seed("src/index.jsx");
        seed("src/index.tsx");
        expect(resolveEntry(project.path, undefined)).toBe(join(project.path, "src/index.tsx"));
    });

    it("detects a JavaScript entry when no TypeScript entry exists", () => {
        seed("src/index.jsx");
        expect(resolveEntry(project.path, undefined)).toBe(join(project.path, "src/index.jsx"));
    });

    it("rejects instead of naming a default entry that does not exist", () => {
        expect(() => resolveEntry(project.path, undefined)).toThrow(
            new Error(
                `No entry file found in ${project.path}. Looked for src/index.tsx, src/index.jsx, ` +
                "src/index.ts, src/index.js; pass the entry file as an argument.",
            ),
        );
    });
});
