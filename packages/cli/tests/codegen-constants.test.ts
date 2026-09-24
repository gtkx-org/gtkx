import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const TYPESCRIPT_CLI = fileURLToPath(new URL("../../../node_modules/typescript/bin/tsc", import.meta.url));
const GIR = readFileSync(new URL("fixtures/gir/ConstantAliases-1.0.gir", import.meta.url), "utf8");
const CONFIG = `export default {
    applicationId: "org.gtkx.constantaliases",
    libraries: ["ConstantAliases-1.0"],
    girPath: ["./gir"],
};\n`;
const CONSUMER = `import {
    WIDE_SIGNED, MIN_SIGNED, MAX_UNSIGNED, ENABLED, DISABLED, NUMERIC_TEXT, PADDED_TEXT, COUNT, OBJECT_TYPE,
    DIRECT_SIGNED, DIRECT_UNSIGNED, DIRECT_NUMBER, DIRECT_BOOLEAN, DIRECT_TEXT,
} from "@gtkx/gi/constantaliases";
export const wideSigned: 9007199254740993n = WIDE_SIGNED;
export const minSigned: -9223372036854775808n = MIN_SIGNED;
export const maxUnsigned: 18446744073709551615n = MAX_UNSIGNED;
export const enabled: true = ENABLED;
export const disabled: false = DISABLED;
export const numericText: "42" = NUMERIC_TEXT;
export const paddedText: "  word, " = PADDED_TEXT;
export const count: 42 = COUNT;
export const objectType: 80n = OBJECT_TYPE;
export const directSigned: -9007199254740993n = DIRECT_SIGNED;
export const directUnsigned: 9007199254740993n = DIRECT_UNSIGNED;
export const directNumber: 23 = DIRECT_NUMBER;
export const directBoolean: true = DIRECT_BOOLEAN;
export const directText: "24" = DIRECT_TEXT;
`;
const TYPECHECK_ARGS = [
    "--no-addons", TYPESCRIPT_CLI, "--noEmit", "--strict", "--skipLibCheck", "false",
    "--target", "ESNext", "--module", "NodeNext", "--moduleResolution", "NodeNext", "--types", "node",
];
const IMPORT_SCRIPT = `import * as values from "@gtkx/gi/constantaliases";
process.stdout.write(JSON.stringify(Object.fromEntries(Object.entries(values).map(([name, value]) => [
    name, { type: typeof value, value: String(value) },
]))));`;

const files = (consumer: string): Record<string, string> => ({
    "gir/ConstantAliases-1.0.gir": GIR,
    "consumer.ts": consumer,
});

describe("generated constant aliases", () => {
    it("preserves primitive values through aliases and alias chains", () => {
        using project = createCliProject({ prefix: "gtkx-constant-aliases-", config: CONFIG, files: files(CONSUMER) });
        runCliOrThrow(project, ["codegen"]);
        const values: unknown = JSON.parse(execFileSync(process.execPath, [
            "--no-addons", "--input-type=module", "--eval", IMPORT_SCRIPT,
        ], { cwd: project.root, encoding: "utf8" }));
        expect(values).toEqual({
            WIDE_SIGNED: { type: "bigint", value: "9007199254740993" },
            MIN_SIGNED: { type: "bigint", value: "-9223372036854775808" },
            MAX_UNSIGNED: { type: "bigint", value: "18446744073709551615" },
            ENABLED: { type: "boolean", value: "true" },
            DISABLED: { type: "boolean", value: "false" },
            NUMERIC_TEXT: { type: "string", value: "42" },
            PADDED_TEXT: { type: "string", value: "  word, " },
            COUNT: { type: "number", value: "42" },
            OBJECT_TYPE: { type: "bigint", value: "80" },
            DIRECT_SIGNED: { type: "bigint", value: "-9007199254740993" },
            DIRECT_UNSIGNED: { type: "bigint", value: "9007199254740993" },
            DIRECT_NUMBER: { type: "number", value: "23" },
            DIRECT_BOOLEAN: { type: "boolean", value: "true" },
            DIRECT_TEXT: { type: "string", value: "24" },
        });
        expect(() => execFileSync(process.execPath, [...TYPECHECK_ARGS, "consumer.ts"], {
            cwd: project.root, encoding: "utf8",
        })).not.toThrow();
    });

    it("rejects a number consumer of a bigint constant", () => {
        using project = createCliProject({
            prefix: "gtkx-constant-alias-type-",
            config: CONFIG,
            files: files(`import { WIDE_SIGNED } from "@gtkx/gi/constantaliases";
export const value: number = WIDE_SIGNED;
`),
        });
        runCliOrThrow(project, ["codegen"]);
        expect(() => execFileSync(process.execPath, [...TYPECHECK_ARGS, "consumer.ts"], {
            cwd: project.root, encoding: "utf8",
        })).toThrow();
    });
});
