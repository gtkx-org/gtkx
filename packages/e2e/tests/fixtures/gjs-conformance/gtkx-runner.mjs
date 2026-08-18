import { runScenario } from "./scenario-suite.mjs";

const moduleUrl = process.env.GTKX_CONFORMANCE_MODULE_URL;

if (moduleUrl === undefined) {
    throw new Error("GTKX_CONFORMANCE_MODULE_URL is required");
}

const api = await import(moduleUrl);
const result = runScenario(api, process.argv[2]);

process.stdout.write(`GTKX_CONFORMANCE_RESULT:${JSON.stringify(result)}\n`);
