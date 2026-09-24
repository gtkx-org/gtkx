import { expect } from "vitest";
import type { MarshallingConsumer } from "./codegen-marshalling-consumers.js";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import { isolateTypeConsumer, typecheckSource } from "./type-consumer.js";

const expectMarshallingConsumer = ({
    library,
    imports,
    accepted,
    rejected,
}: MarshallingConsumer): void => {
    using project = createCliProject({
        prefix: "gtkx-cli-codegen-marshalling-",
        config: fixtureConfig(library),
    });
    expect(runCli(project, ["codegen"]).status).toBe(0);
    isolateTypeConsumer(project);
    expect(typecheckSource(project, imports + accepted)).toBe(0);

    for (const source of rejected) {
        expect(typecheckSource(project, imports + source)).not.toBe(0);
    }
};

export { expectMarshallingConsumer };
