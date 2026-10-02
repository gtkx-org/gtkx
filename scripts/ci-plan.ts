import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const isFullRun = process.env.GTKX_CI_FULL === "true";
const args = [fileURLToPath(import.meta.resolve("nx")), "show", "projects", "--with-target=test", "--json"];

if (!isFullRun) {
    if (!process.env.NX_BASE || !process.env.NX_HEAD) {
        throw new Error("Affected planning requires both Git revisions");
    }
    args.push("--affected");
}

const result: unknown = JSON.parse(execFileSync(process.execPath, args, { encoding: "utf8" }));
const isStringList = (value: unknown): value is string[] =>
    Array.isArray(value) && value.every((item: unknown) => typeof item === "string");

if (!isStringList(result)) {
    throw new Error("Invalid Nx project selection");
}

const projects: Set<string> = new Set(result);
const separate = new Set(["@gtkx/animated", "@gtkx/cli", "@gtkx/mcp"]);

console.log(JSON.stringify({
    core: [...projects].some((project) => !separate.has(project)),
    animated: projects.has("@gtkx/animated"),
    cli: projects.has("@gtkx/cli"),
    mcp: projects.has("@gtkx/mcp"),
    projects: [...projects].toSorted((left, right) => left.localeCompare(right)),
}));
