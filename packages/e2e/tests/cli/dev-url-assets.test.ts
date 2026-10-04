import { once } from "node:events";
import { readFileSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createCliProject, startCli } from "./cli-project.js";

type Observation = { pid: number; value: string };

const ASSET = "data/executor";
const OBSERVATION = "node_modules/asset-observation.json";
const FAILURE = "node_modules/asset-failure.json";
const FIRST = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 1, 0, 0, 0]);
const SECOND = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 2, 0, 0, 0]);
const BOOTSTRAP = `import { writeFileSync } from "node:fs";
try {
    await import("./app.ts");
} catch (cause) {
    writeFileSync("${FAILURE}", JSON.stringify({ pid: process.pid }));
    throw cause;
}
`;
const ENTRY = `import asset from "../data/executor?url";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
writeFileSync("${OBSERVATION}.pending", JSON.stringify({
    pid: process.pid,
    value: readFileSync(asset).toString("hex"),
}));
renameSync("${OBSERVATION}.pending", "${OBSERVATION}");
setInterval(() => undefined, 1000);
`;

it("reloads binary URL assets, replacements, recreations, and recovered source errors", async () => {
    using project = createCliProject({
        prefix: "gtkx-dev-url-assets-",
        config: 'export default { applicationId: "org.gtkx.devassets", codegen: false };',
        hasStore: true,
        files: { [ASSET]: FIRST, "src/index.ts": BOOTSTRAP, "src/app.ts": ENTRY },
    });
    const child = startCli(project, ["dev", "--headless"]);
    const closed = once(child, "close");
    child.stdout?.resume();
    child.stderr?.resume();
    const observe = (): Observation => JSON.parse(
        readFileSync(join(project.root, OBSERVATION), "utf8"),
    ) as Observation;
    const poll = { timeout: 30_000 };

    try {
        await expect.poll(observe, poll).toMatchObject({ value: FIRST.toString("hex") });
        const initial = observe();
        unlinkSync(join(project.root, ASSET));
        await expect.poll(() => {
            try {
                process.kill(initial.pid, 0);

                return false;
            } catch {
                return true;
            }
        }, poll).toBe(true);
        await expect.poll(() => {
            const failed = JSON.parse(readFileSync(join(project.root, FAILURE), "utf8")) as { pid: number };

            return failed.pid;
        }, poll).toBeGreaterThan(0);
        expect(child.exitCode).toBeNull();
        writeFileSync(join(project.root, ASSET), SECOND);
        await expect.poll(observe, poll).toMatchObject({ value: SECOND.toString("hex") });
        const recreated = observe();
        expect(recreated.pid).not.toBe(initial.pid);
        writeFileSync(join(project.root, ASSET), FIRST);
        await expect.poll(observe, poll).toMatchObject({ value: FIRST.toString("hex") });
        const changed = observe();
        expect(changed.pid).not.toBe(recreated.pid);
        writeFileSync(join(project.root, `${ASSET}.pending`), SECOND);
        renameSync(join(project.root, `${ASSET}.pending`), join(project.root, ASSET));
        await expect.poll(observe, poll).toMatchObject({ value: SECOND.toString("hex") });
        const replaced = observe();
        expect(replaced.pid).not.toBe(changed.pid);
        writeFileSync(join(project.root, "src/app.ts"), 'throw new Error("Unavailable");\n');
        await expect.poll(() => {
            try {
                process.kill(replaced.pid, 0);

                return false;
            } catch {
                return true;
            }
        }, poll).toBe(true);
        expect(child.exitCode).toBeNull();
        writeFileSync(join(project.root, ASSET), FIRST);
        writeFileSync(join(project.root, "src/app.ts"), ENTRY);
        await expect.poll(observe, poll).toMatchObject({ value: FIRST.toString("hex") });
        expect(observe().pid).not.toBe(replaced.pid);
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});
