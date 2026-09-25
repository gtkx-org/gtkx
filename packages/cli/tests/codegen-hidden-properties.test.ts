import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    ACCEPTED,
    createHiddenPropertiesProject,
    type RejectedName,
} from "./codegen-hidden-properties-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const REJECTED_NAMES = ["integer-control"] as const satisfies readonly RejectedName[];

describe("generated raw-pointer property omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenPropertiesProject(
            "gtkx-cli-hidden-property-types-",
            { "accepted.tsx": ACCEPTED },
            REJECTED_NAMES,
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves integer, GType, object, boxed, array and inherited construction", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
    });

    it.each(REJECTED_NAMES)("rejects the unsupported property consumer %s", (name) => {
        expect(typecheckFile(project, `${name}.tsx`)).not.toBe(0);
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
