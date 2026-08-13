import { describe, expect, it } from "vitest";
import { isMissingImport, missingImportName } from "../../src/dev/missing-import.js";

const VITE_FAILURE = "Failed to load url ./theme.js (resolved id: ./theme.js) in /x/app.tsx. Does the file exist?";

describe("missingImportName", () => {
    it("names the file the dev server could not load", () => {
        expect(missingImportName(new Error(VITE_FAILURE))).toBe("theme");
    });

    it("reads a failure reported as a plain value", () => {
        expect(missingImportName("Failed to load url ../shared/theme")).toBe("theme");
    });

    it("names nothing when the failure is one no file can fix", () => {
        expect(missingImportName(new Error("PROBE: Unexpected token"))).toBeNull();
    });

    it("names nothing when the url points at no file to wait for", () => {
        expect(missingImportName(new Error("Failed to load url ./"))).toBeNull();
    });
});

describe("isMissingImport", () => {
    it("matches the created file the import asked for, whatever extension it landed with", () => {
        expect(isMissingImport("/x/theme.ts", "theme")).toBe(true);
        expect(isMissingImport("/x/theme.tsx", "theme")).toBe(true);
    });

    it("matches the index file that completes the directory the import asked for", () => {
        expect(isMissingImport("/x/theme/index.ts", "theme")).toBe(true);
    });

    it("ignores files the import never asked for", () => {
        expect(isMissingImport("/x/scratch.log", "theme")).toBe(false);
        expect(isMissingImport("/x/palette/index.ts", "theme")).toBe(false);
        expect(isMissingImport("/x/themes.ts", "theme")).toBe(false);
    });
});
