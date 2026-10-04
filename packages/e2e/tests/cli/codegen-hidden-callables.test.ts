import { loadApiReference, resolveGirPath } from "@gtkx/codegen";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { CliProject } from "./cli-project.js";
import {
    ACCEPTED,
    createHiddenCallablesProject,
    NATIVE_CONSUMER,
} from "./codegen-hidden-callables-fixture.js";
import { typecheckFile } from "./type-consumer.js";

const OMISSIONS = [
    "takeDirect", "takeAlias", "readDirect", "readAlias", "returnDirect", "returnAlias", "discardPointer",
    "takeArray", "takeList", "takeHashValues", "readHashKeys", "takeNested", "newWithData",
    "rawList", "rawArray", "rawHash",
];

describe("generated raw-pointer callable omissions", () => {
    const cleanup = new DisposableStack();
    let project: CliProject;

    beforeAll(() => {
        project = cleanup.use(createHiddenCallablesProject(
            "gtkx-cli-hidden-callable-types-",
            {
                "accepted.tsx": ACCEPTED,
                "native.ts": NATIVE_CONSUMER,
            },
        ));
    });

    afterAll(() => {
        cleanup.dispose();
    });

    it("preserves safe values, annotated arrays, typed handles and existing adapters", () => {
        expect(typecheckFile(project, "accepted.tsx")).toBe(0);
        expect(typecheckFile(project, "native.ts")).toBe(0);
    });

    it("keeps class and namespace reference output aligned with supported callables", () => {
        const reference = loadApiReference({
            libraries: ["CallablePointers-1.0", "Gio-2.0"],
            girPath: resolveGirPath(["gir"], project.root),
            resolveFrom: project.root,
        });
        const probe = reference.lookup("CallablePointers.Probe", "class");
        expect(probe.outcome).toBe("page");
        for (const name of ["getCount", "echoType", "echoBytes", "readBytes", "readByteArray", "revision", "payload"]) {
            expect(probe).toHaveProperty("markdown", expect.stringContaining("### `" + name + "`"));
        }
        for (const name of OMISSIONS) {
            expect(probe).toHaveProperty("markdown", expect.not.stringContaining("### `" + name + "`"));
        }
        const value = reference.lookup("GObject.Value", "record");
        expect(value.outcome).toBe("page");
        expect(value).toHaveProperty("markdown", expect.stringContaining("getBoxed<T = unknown>(): T"));
        expect(value).toHaveProperty("markdown", expect.stringContaining("### `setBoxed`"));
        expect(reference.lookup("CallablePointers.safeCount", "function").outcome).toBe("page");
        for (const name of [
            "CallablePointers.acceptPointer", "CallablePointers.getPointer", "GObject.typeGetQdata",
            "GObject.typeFreeInstance", "GObject.enumRegisterStatic", "GObject.flagsRegisterStatic",
        ]) {
            expect(reference.lookup(name, "function").outcome).toBe("notFound");
        }
        const typeModule = reference.lookup("GObject.TypeModule", "class");
        expect(typeModule.outcome).toBe("page");
        expect(typeModule).toHaveProperty("markdown", expect.not.stringContaining("### `registerEnum`"));
        expect(typeModule).toHaveProperty("markdown", expect.not.stringContaining("### `registerFlags`"));
        expect(typeModule).toHaveProperty("markdown", expect.stringContaining("### `registerType`"));
    });
});
