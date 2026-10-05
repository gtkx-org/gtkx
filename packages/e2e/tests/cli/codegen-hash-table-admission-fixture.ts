import { readFileSync } from "node:fs";
import type { CliProject } from "./cli-project.js";
import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.numerictables",
    libraries: ["NumericTables-1.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;
const HASH_TABLE_IMPORTS = `import * as GObject from "@gtkx/gi/gobject";
import * as NumericTables from "@gtkx/gi/numerictables";
import { NumericTablesProbe } from "@gtkx/jsx/numerictables";
`;

const rejectedFiles = (rejected: Record<string, string>): Record<string, string> =>
    Object.fromEntries(Object.entries(rejected).map(([name, source]) => [
        `${name}.tsx`, HASH_TABLE_IMPORTS + source,
    ]));

const createHashTableAdmissionProject = (
    cleanup: DisposableStack,
    prefix: string,
    rejected: Record<string, string>,
    files: Record<string, string> = {},
): CliProject => {
    const fixture = readFileSync(new URL("fixtures/gir/NumericTables-1.0.gir", import.meta.url));
    const project = cleanup.use(createCliProject({
        prefix,
        config: CONFIG,
        files: { "gir/NumericTables-1.0.gir": fixture, ...files, ...rejectedFiles(rejected) },
    }));
    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);

    return project;
};

export { createHashTableAdmissionProject, HASH_TABLE_IMPORTS };
