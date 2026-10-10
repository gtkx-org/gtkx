import { loadConfig } from "@gtkx/config";
import { info } from "@gtkx/utils";
import { resolve } from "node:path";
import { parseArgs } from "node:util";
import { generateBindings } from "./project/generate.js";

const { values } = parseArgs({
    options: {
        cwd: { type: "string" },
        config: { type: "string" },
        force: { type: "boolean", default: false },
    },
});
const cwd = resolve(values.cwd ?? process.cwd());
const { config } = await loadConfig(cwd, { configFile: values.config });

if (config.codegen === false) {
    info("codegen: disabled for this project; reusing an installed binding store");
} else {
    const result = await generateBindings({ cwd, config, isForced: values.force });
    info(result.isRegenerated ? "codegen: regenerated bindings" : "codegen: bindings up to date");
}
