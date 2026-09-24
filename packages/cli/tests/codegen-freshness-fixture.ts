import { execFileSync } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import type { CliProject } from "./cli-project.js";

const constantGir = (value: number, version = "1.0"): string => `<?xml version="1.0"?>
<repository version="1.2"
  xmlns="http://www.gtk.org/introspection/core/1.0"
  xmlns:c="http://www.gtk.org/introspection/c/1.0">
  <namespace name="SearchOrder" version="${version}">
    <constant name="VALUE" value="${String(value)}" c:type="SEARCH_ORDER_VALUE">
      <type name="gint" c:type="gint"/>
    </constant>
  </namespace>
</repository>
`;

const dependentGir = (name: string, version: string): string => `<?xml version="1.0"?>
<repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0">
  <include name="SearchOrder" version="${version}"/>
  <namespace name="${name}" version="1.0">
    <constant name="PRESENT" value="1"><type name="gint"/></constant>
  </namespace>
</repository>
`;

const configure = (project: CliProject, girPath: string[], libraries = ["SearchOrder-1.0"]): void => {
    const config = {
        applicationId: "com.gtkx.freshness",
        agents: { reference: false },
        libraries,
        girPath,
    };
    writeFileSync(join(project.root, "gtkx.config.ts"), `export default ${JSON.stringify(config)};\n`);
};

const writeGir = (directory: string, identifier: string, source: string): void => {
    mkdirSync(directory, { recursive: true });
    writeFileSync(join(directory, `${identifier}.gir`), source);
};

const importValue = (project: CliProject): number => Number(execFileSync(process.execPath, [
    "--no-addons", "--input-type=module", "--eval",
    'import { VALUE } from "@gtkx/gi/searchorder"; process.stdout.write(String(VALUE));',
], { cwd: project.root, encoding: "utf8" }));

export { configure, constantGir, dependentGir, importValue, writeGir };
