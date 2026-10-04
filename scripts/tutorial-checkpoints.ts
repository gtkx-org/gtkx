import { parseArgs } from "node:util";
import { createCheckpoint } from "../packages/e2e/tests/helpers/tutorial-checkpoints.js";

const { values } = parseArgs({
    options: {
        chapter: { type: "string", default: "flatpak" },
        version: { type: "string", default: "v2" },
        output: { type: "string" },
    },
});

if (values.version !== "v1" && values.version !== "v2") {
    throw new Error("Choose --version v2 or v1");
}

await createCheckpoint({ ...values, version: values.version });
