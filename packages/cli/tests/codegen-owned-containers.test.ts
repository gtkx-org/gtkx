import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";
import { createCliProject, runCliOrThrow } from "./cli-project.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.ownedcontainers",
    libraries: ["OSTree-1.0"],
};
`;
const IMPORTS = `import assert from "node:assert/strict";
import { Sign } from "@gtkx/gi/ostree";
`;
const CASES = [
    {
        title: "returns usable signing engines from an owning array",
        source: `const engines = Sign.getAll();
assert.ok(engines.length > 0);
const names = engines.map((engine) => engine.getName());
assert.equal(new Set(names).size, names.length);
for (const name of names) {
    assert.ok(name.length > 0);
    assert.equal(Sign.getByName(name).getName(), name);
}
`,
    },
    {
        title: "keeps earlier engines usable across another enumeration",
        source: `const first = Sign.getAll();
const names = first.map((engine) => engine.getName());
const second = Sign.getAll();
assert.ok(first.length > 0);
assert.deepEqual(second.map((engine) => engine.getName()), names);
assert.deepEqual(first.map((engine) => engine.getName()), names);
for (const [index, engine] of first.entries()) {
    assert.notEqual(engine, second[index]);
}
`,
    },
    {
        title: "rejects an unavailable signing engine",
        source: `assert.throws(() => Sign.getByName("gtkx-unavailable-signing-engine"));
`,
    },
];

describe("generated owning container returns", () => {
    it.each(CASES)("$title", ({ source }) => {
        using project = createCliProject({ prefix: "gtkx-owned-containers-", config: CONFIG });
        runCliOrThrow(project, ["codegen"]);

        expect(() => execFileSync(process.execPath, [
            "--conditions=source", "--import=tsx", "--input-type=module", "--eval", IMPORTS + source,
        ], { cwd: project.root, stdio: "pipe" })).not.toThrow();
    });
});
