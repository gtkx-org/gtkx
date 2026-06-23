import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { loadUserRules, readUserRulesSource } from "../../src/codegen/user-rules.js";

const TS_RULES_SOURCE = [
    "const rules = (builtins: Record<string, unknown>): Record<string, unknown> => ({",
    "    ...builtins,",
    '    MyAppChart: { extraProps: { seriesLabel: "string" } },',
    "});",
    "export default rules;",
    "",
].join("\n");

const PACKAGE_RULES_SOURCE = ["export default (builtins) => ({ ...builtins, FromPackage: {} });", ""].join("\n");

describe("user rules loading", () => {
    let projectRoot: string;

    beforeEach(() => {
        projectRoot = mkdtempSync(join(tmpdir(), "gtkx-rules-"));
    });

    afterEach(() => {
        rmSync(projectRoot, { recursive: true, force: true });
    });

    const installRulesPackage = (name: string): void => {
        const pkgDir = join(projectRoot, "node_modules", name);
        mkdirSync(pkgDir, { recursive: true });
        writeFileSync(
            join(pkgDir, "package.json"),
            JSON.stringify({ name, version: "1.0.0", type: "module", exports: "./index.js" }),
        );
        writeFileSync(join(pkgDir, "index.js"), PACKAGE_RULES_SOURCE);
    };

    it("returns undefined and empty source when no specifier is configured", async () => {
        await expect(loadUserRules(projectRoot, undefined)).resolves.toBeUndefined();
        expect(readUserRulesSource(projectRoot, undefined)).toBe("");
    });

    it("loads a relative TypeScript rules module the shipped CLI could not import natively", async () => {
        writeFileSync(join(projectRoot, "gtkx-rules.ts"), TS_RULES_SOURCE);
        const rules = await loadUserRules(projectRoot, "./gtkx-rules.ts");
        expect(rules).toBeTypeOf("function");
        expect(rules?.({})).toEqual({ MyAppChart: { extraProps: { seriesLabel: "string" } } });
    });

    it("resolves an extensionless relative specifier to its TypeScript source", () => {
        writeFileSync(join(projectRoot, "gtkx-rules.ts"), TS_RULES_SOURCE);
        expect(readUserRulesSource(projectRoot, "./gtkx-rules")).toBe(TS_RULES_SOURCE);
    });

    it("resolves a bare package specifier through node_modules rather than as a path", async () => {
        installRulesPackage("gtkx-rules-pkg");
        const rules = await loadUserRules(projectRoot, "gtkx-rules-pkg");
        expect(rules?.({})).toEqual({ FromPackage: {} });
        expect(readUserRulesSource(projectRoot, "gtkx-rules-pkg")).toBe(PACKAGE_RULES_SOURCE);
    });

    it("returns empty source for an unresolvable specifier instead of a corrupted path read", () => {
        expect(readUserRulesSource(projectRoot, "definitely-not-installed")).toBe("");
    });
});
