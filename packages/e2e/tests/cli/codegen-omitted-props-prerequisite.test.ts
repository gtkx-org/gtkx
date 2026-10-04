import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow, STORE_LIBRARIES } from "./cli-project.js";
import { omittedPropsConfig } from "./codegen-omitted-props-fixture.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

describe("configured GIR property omissions for interface prerequisites", () => {
    it("omits interface prerequisite props while preserving the prerequisite type", () => {
        using project = createCliProject({
            prefix: "gtkx-omitted-prerequisite-",
            config: omittedPropsConfig({ OmittedPropsChild: { omittedProps: ["value"] } }, {
                libraries: [...STORE_LIBRARIES, "OmittedProps-1.0"],
                girPath: ["./gir"],
            }),
            files: {
                "gir/OmittedProps-1.0.gir": readFileSync(new URL("fixtures/gir/OmittedProps-1.0.gir", import.meta.url)),
            },
        });
        runCliOrThrow(project, ["codegen"]);
        isolateTypeConsumer(project);
        const imports = "import type { OmittedPropsChildProps, OmittedPropsParentProps } " +
            'from "@gtkx/jsx/omittedprops";\n';
        expect(typecheckSource(project, imports + `
            export const parent: OmittedPropsParentProps = { value: 1, onNotifyValue: () => undefined };
            export const child: OmittedPropsChildProps = { active: true };
        `)).toBe(0);
        for (const props of ["{ value: 1 }", "{ onNotifyValue: () => undefined }"]) {
            expect(typecheckSource(project, imports + `export const child: OmittedPropsChildProps = ${props};`))
                .not.toBe(0);
        }
    });
});
