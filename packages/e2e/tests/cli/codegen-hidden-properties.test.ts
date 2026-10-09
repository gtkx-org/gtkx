import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import { ACCEPTED, createHiddenPropertiesProject, REJECTED_NAMES } from "./codegen-hidden-properties-fixture.js";
import { typecheckFiles } from "./type-consumer.js";

describe("generated raw-pointer property omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(
            createHiddenPropertiesProject(
                "gtkx-cli-hidden-property-types-",
                { "accepted.tsx": ACCEPTED },
                REJECTED_NAMES,
            ),
        );
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves supported consumers and rejects the omitted public contracts", () => {
        const accepted = ["accepted.tsx"];
        const rejected = REJECTED_NAMES.map((name) => `${name}.tsx`);

        for (const [file, result] of typecheckFiles(project, [...accepted, ...rejected])) {
            expect({ file, ...result }).toMatchObject({ status: accepted.includes(file) ? 0 : 1 });
        }
    });

    it("omits pointer properties from class and element reference pages", () => {
        const reference = loadApiReference({
            libraries: ["HiddenProperties-1.0", "Gio-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        const probeFields = ["count", "typeId", "owner", "bytes", "names"];
        const probeOmissions = ["data", "aliasedData"];
        const streamOmissions = ["data", "destroyFunction", "reallocFunction"];
        const pages = [
            { query: "HiddenProperties.Probe", kind: "class", retained: probeFields, omitted: probeOmissions },
            { query: "HiddenPropertiesProbe", kind: "element", retained: probeFields, omitted: probeOmissions },
            { query: "Gio.MemoryOutputStream", kind: "class", retained: ["size"], omitted: streamOmissions },
            { query: "GMemoryOutputStream", kind: "element", retained: ["size"], omitted: streamOmissions },
        ] as const;
        for (const { query, kind, retained, omitted } of pages) {
            const page = reference.lookup(query, kind);
            expect(page.outcome).toBe("page");
            for (const name of retained) {
                expect(page).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
            }
            for (const name of omitted) {
                expect(page).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
            }
        }
    });
});
