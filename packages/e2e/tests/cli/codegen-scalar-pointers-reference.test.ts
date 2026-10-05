import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    createScalarPointerProject,
    SCALAR_POINTER_OMITTED_METHODS,
} from "./codegen-scalar-pointers-fixture.js";

describe("generated scalar C pointer omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;
    let reference: ReturnType<typeof loadApiReference>;

    beforeAll(() => {
        project = cleanup.use(createScalarPointerProject("gtkx-cli-scalar-pointer-reference-", {}));
        reference = loadApiReference({
            libraries: ["ScalarPointers-1.0", "Gtk-4.0", "GdkPixbuf-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("aligns method, property, signal and field references", () => {
        const probe = reference.lookup("ScalarPointers.Probe", "class");
        const element = reference.lookup("ScalarPointersProbe", "element");
        const frame = reference.lookup("ScalarPointers.Frame", "record");
        expect(probe.outcome).toBe("page");
        expect(element.outcome).toBe("page");
        expect(frame.outcome).toBe("page");
        for (const name of [
            "readNumber", "editNumber", "readCount", "readArray", "useValues", "takeArray", "useInout", "count",
        ]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of [...SCALAR_POINTER_OMITTED_METHODS, "pointer", "scalar-pointer", "scalar-return"]) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        expect(element).toHaveProperty("markdown", expect.stringContaining("### `onInteger`"));
        for (const name of ["pointer", "onScalarPointer", "onScalarReturn"]) {
            expect(element).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
        for (const name of ["before", "after"]) {
            expect(frame).toHaveProperty("markdown", expect.stringContaining(`### \`${name}\``));
        }
        for (const name of ["direct", "alias", "pointers"]) {
            expect(frame).toHaveProperty("markdown", expect.not.stringContaining(`### \`${name}\``));
        }
    });

    it("omits pointer aliases and callback references while retaining scalar callbacks", () => {
        for (const name of ["IntPointer", "PointerAlias", "PointerList", "OwnPointer"]) {
            expect(reference.lookup(`ScalarPointers.${name}`, "alias").outcome).toBe("notFound");
        }
        for (const name of ["RAW_POINTER", "DIRECT_SCALAR_POINTER", "ALIASED_POINTER"]) {
            expect(reference.lookup(`ScalarPointers.${name}`, "constant").outcome).toBe("notFound");
        }
        for (const name of ["InputScalar", "ReturnScalar"]) {
            expect(reference.lookup(`ScalarPointers.${name}`, "callback").outcome).toBe("notFound");
        }
        expect(reference.lookup("ScalarPointers.Count", "alias").outcome).toBe("page");
        expect(reference.lookup("ScalarPointers.InoutScalar", "callback").outcome).toBe("page");
        expect(reference.lookup("ScalarPointers.OutScalar", "callback").outcome).toBe("page");
        expect(reference.lookup("ScalarPointers.readScalar", "function").outcome).toBe("notFound");
    });
});
