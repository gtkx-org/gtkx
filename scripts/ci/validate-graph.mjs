import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const path = process.argv[2];
assert.ok(path, "Pass the generated Nx task graph path");
const { graph, tasks } = JSON.parse(readFileSync(path, "utf8"));
const targets = new Set();
let atoms = 0;

for (const [id, task] of Object.entries(tasks.tasks)) {
    const target = graph.nodes[task.target.project].data.targets[task.target.target];
    assert.equal(target.cache, true, `${id} must be cacheable for Nx Agents`);
    targets.add(task.target.target);

    if (target.executor !== "nx:noop") {
        assert.equal(target.executor, "nx:run-commands", `${id} needs an explicit container command`);
        const commands = target.options.commands ?? [target.options.command];

        for (const command of commands) {
            const value = typeof command === "string" ? command : command.command;
            assert.ok(value.includes("scripts/ci/run.mjs"), `${id} bypasses the workload container`);
        }
    }

    if (task.target.target.startsWith("e2e-ci--")) {
        atoms += 1;
        const dependencies = tasks.dependencies[id];
        assert.ok(dependencies.includes("gtkx:_build:bindings"), `${id} needs generated bindings`);
        assert.ok(dependencies.includes("@gtkx/cli:build"), `${id} needs the CLI build`);
        assert.ok(target.inputs.some((input) => typeof input === "object"
            && input.dependentTasksOutputFiles?.includes("node")), `${id} must hash native outputs`);
    }
}

for (const target of ["build", "test", "typecheck", "lint", "e2e-ci", "_test:asan"]) {
    assert.ok(targets.has(target), `Unknown distributed completion target: ${target}`);
}

assert.ok(atoms > 0, "No CLI E2E atoms were discovered");
console.log(`Validated ${Object.keys(tasks.tasks).length} cacheable tasks and ${atoms} CLI E2E atoms`);
