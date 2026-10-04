import { runGlCodegen } from "@gtkx/codegen/internal";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { createCliProject } from "./cli-project.js";

const REGISTRY = `<registry>
<commands>
<command>
<proto>void <name>glClear</name></proto>
<param><ptype>GLbitfield</ptype> <name>mask</name></param>
</command>
</commands>
<feature api="gl" name="GL_VERSION_1_0" number="1.0">
<require><command name="glClear"/></require>
</feature>
</registry>`;

const NATIVE_TYPES = fileURLToPath(new URL("../../../native/main.d.ts", import.meta.url));

describe("OpenGL codegen project aliases", () => {
    it.each([false, true])("checks generated modules with inherited paths (baseUrl: %s)", (hasBaseUrl) => {
        using project = createCliProject({
            prefix: "gtkx-gl-tsconfig-",
            files: {
                "registry.xml": REGISTRY,
                "overrides.ts": "export {};\n",
                "native.ts": "export {};\n",
                "tsconfig.json": JSON.stringify({ extends: "./config/tsconfig.base.json" }),
                "config/tsconfig.base.json": JSON.stringify({
                    compilerOptions: {
                        composite: true,
                        rootDir: "./unrelated",
                        ...(hasBaseUrl && { baseUrl: ".." }),
                        paths: { "@gtkx/native": [hasBaseUrl ? "./native.ts" : "../native.ts"] },
                    },
                }),
            },
        });
        const options = {
            registryPath: join(project.root, "registry.xml"),
            overridePath: join(project.root, "overrides.ts"),
            outputDir: join(project.root, "generated"),
            resolveFrom: project.root,
        };

        expect(() => runGlCodegen(options)).toThrow(/has no exported member 'ExternalObject'/);

        writeFileSync(
            join(project.root, "native.ts"),
            `export type { ExternalObject, Handle } from ${JSON.stringify(NATIVE_TYPES)};\n`,
        );

        expect(runGlCodegen(options).emittedCommands).toBe(1);
        expect(readFileSync(join(options.outputDir, "commands.ts"), "utf8")).toContain("export function clear(");
    });
});
