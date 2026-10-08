import { expect } from "vitest";
import type { MarshallingConsumer } from "./codegen-marshalling-consumers.js";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckFiles } from "./type-consumer.js";

const expectMarshallingConsumer = ({ library, imports, accepted, rejected }: MarshallingConsumer): void => {
    const files = {
        "accepted.tsx": imports + accepted,
        ...Object.fromEntries(rejected.map((source, index) => [`rejected-${String(index)}.tsx`, imports + source])),
    };
    using project = createCliProject({
        prefix: "gtkx-cli-codegen-marshalling-",
        config: fixtureConfig(library),
        files,
    });
    expect(runCli(project, ["codegen"]).status).toBe(0);
    isolateTypeConsumer(project);
    for (const [file, result] of typecheckFiles(project, Object.keys(files))) {
        expect({ file, ...result }).toMatchObject({ status: file === "accepted.tsx" ? 0 : 1 });
    }
};

export { expectMarshallingConsumer };
