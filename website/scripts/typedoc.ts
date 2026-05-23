import { rmSync } from "node:fs";
import { resolve } from "node:path";
import { Application } from "typedoc";
import { packages } from "../typedoc.config.ts";

const website = resolve(import.meta.dirname, "..");
const apiDir = resolve(website, "api");
const optionsPath = resolve(website, "typedoc.json");

rmSync(apiDir, { recursive: true, force: true });

for (const pkg of packages) {
    console.log(`Generating API docs for @gtkx/${pkg.name}...`);
    const app = await Application.bootstrapWithPlugins({
        options: optionsPath,
        entryPoints: pkg.entryPoints,
        tsconfig: pkg.tsconfig,
        out: resolve(apiDir, pkg.name),
        intentionallyNotExported: pkg.intentionallyNotExported,
    });
    const project = await app.convert();
    if (!project) throw new Error(`TypeDoc conversion failed for @gtkx/${pkg.name}`);
    app.validate(project);
    await app.generateOutputs(project);
}

console.log("API docs generated.");
