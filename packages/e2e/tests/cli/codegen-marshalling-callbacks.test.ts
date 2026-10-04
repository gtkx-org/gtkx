import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import { fixtureConfig } from "./codegen-helpers.js";
import { CALLBACK_MARSHALLING_CONSUMERS } from "./codegen-marshalling-consumers.js";
import { typecheckProject } from "./codegen-marshalling-project.js";
import { expectMarshallingConsumer } from "./codegen-marshalling-suite.js";

const SIDE_CALLBACK_PROBE = `import type { Job, ProgressCallback } from "@gtkx/gi/asyncpair";

export const load = (job: Job, progress: ProgressCallback): Promise<boolean>[] => [
    job.loadAsync(),
    job.loadAsync(null, progress),
    job.loadAsync(null, null),
];

export const transform = (job: Job): void => {
    job.transformAsync((value) => value, () => undefined);
};
`;

describe("gtkx codegen marshalling", () => {
    it.each(CALLBACK_MARSHALLING_CONSUMERS)("$title", (consumer) => {
        expectMarshallingConsumer(consumer);
    });

    it("exposes supported side callbacks through the generated API", () => {
        using project = createCliProject({
            prefix: "gtkx-cli-codegen-async-side-callback-",
            config: fixtureConfig("AsyncPair-1.0"),
            files: { "probe.ts": SIDE_CALLBACK_PROBE },
        });

        expect(runCli(project, ["codegen"]).status).toBe(0);
        expect(typecheckProject(project)).toBe(0);
    });
});
