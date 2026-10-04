import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    ACCEPTED,
    createUnknownArraysProject,
    NATIVE_CONSUMER,
} from "./codegen-unknown-arrays-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const OMITTED_MEMBERS = ["takeDirect", "readAlias", "readNested", "discardArray", "useRaw", "data", "nested"];

describe("generated unknown-length array omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createUnknownArraysProject(
            "gtkx-cli-unknown-array-types-",
            {
                "accepted.tsx": ACCEPTED,
                "native.ts": NATIVE_CONSUMER,
            },
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves bounded arrays, intrinsic byte arrays and neighboring properties and fields", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it("keeps references aligned with omitted aliases and retained array methods", () => {
        const reference = loadApiReference({
            libraries: ["UnknownArrays-1.0", "Gtk-4.0", "GdkPixbuf-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        const probe = reference.lookup("UnknownArrays.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of [
            "readSized", "readFixed", "readTerminated", "readIntrinsic", "readNestedBytes",
            "useSized", "count", "payload",
        ]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining("### `" + name + "`"));
        }
        for (const name of OMITTED_MEMBERS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining("### `" + name + "`"));
        }
        const frame = reference.lookup("UnknownArrays.Frame", "record");
        expect(frame.outcome).toBe("page");
        for (const name of ["before", "after", "buffer"]) {
            expect(frame).toHaveProperty("markdown", expect.stringContaining("### `" + name + "`"));
        }
        for (const name of ["data", "nested"]) {
            expect(frame).toHaveProperty("markdown", expect.not.stringContaining("### `" + name + "`"));
        }
        for (const name of ["RawBytes", "RawAlias", "NestedRaw", "CallbackAlias"]) {
            expect(reference.lookup("UnknownArrays." + name, "alias").outcome).toBe("notFound");
        }
        expect(reference.lookup("UnknownArrays.RawCallback", "callback").outcome).toBe("notFound");
        expect(reference.lookup("UnknownArrays.unknownBytes", "function").outcome).toBe("notFound");
        expect(reference.lookup("UnknownArrays.IntrinsicBytes", "alias").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.NestedBytes", "alias").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.SizedCallback", "callback").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.fullInlineRecord", "function").outcome).toBe("page");
        expect(reference.lookup("UnknownArrays.fullFixedPointerRecord", "function").outcome).toBe("notFound");
        expect(reference.lookup("UnknownArrays.fullAliasedPointerRecord", "function").outcome).toBe("notFound");
        const pixbuf = reference.lookup("GdkPixbuf.Pixbuf", "class");
        expect(pixbuf.outcome).toBe("page");
        expect(pixbuf).toHaveProperty("markdown", expect.stringContaining("getPixels(): Uint8Array"));
        expect(pixbuf).toHaveProperty("markdown", expect.not.stringContaining("### `newFromData`"));
    });
});
