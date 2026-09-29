import { once } from "node:events";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createCliProject, startCli } from "./cli-project.js";

type Observation = { pid: number; value: string };

const ASSET = "data/executor";
const OBSERVATION = "node_modules/asset-observation.json";
const FIRST = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 1, 0, 0, 0]);
const SECOND = Buffer.from([0x7F, 0x45, 0x4C, 0x46, 2, 0, 0, 0]);
const ENTRY = `import asset from "../data/executor?url";
import { readFileSync, renameSync, writeFileSync } from "node:fs";
writeFileSync("${OBSERVATION}.pending", JSON.stringify({
    pid: process.pid,
    value: readFileSync(asset).toString("hex"),
}));
renameSync("${OBSERVATION}.pending", "${OBSERVATION}");
setInterval(() => undefined, 1000);
`;

it("reloads binary URL assets, atomic replacements, and recovered source errors", async () => {
    using project = createCliProject({
        prefix: "gtkx-dev-url-assets-",
        config: 'export default { applicationId: "org.gtkx.devassets", codegen: false };',
        hasStore: true,
        files: { [ASSET]: FIRST, "src/index.ts": ENTRY },
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
        writeFileSync(join(project.root, ASSET), SECOND);
        await expect.poll(observe, poll).toMatchObject({ value: SECOND.toString("hex") });
        const changed = observe();
        expect(changed.pid).not.toBe(initial.pid);
        writeFileSync(join(project.root, `${ASSET}.pending`), FIRST);
        renameSync(join(project.root, `${ASSET}.pending`), join(project.root, ASSET));
        await expect.poll(observe, poll).toMatchObject({ value: FIRST.toString("hex") });
        const replaced = observe();
        expect(replaced.pid).not.toBe(changed.pid);
        writeFileSync(join(project.root, "src/index.ts"), 'throw new Error("Unavailable");\n');
        await expect.poll(() => {
            try {
                process.kill(replaced.pid, 0);

                return false;
            } catch {
                return true;
            }
        }, poll).toBe(true);
        expect(child.exitCode).toBeNull();
        writeFileSync(join(project.root, ASSET), SECOND);
        writeFileSync(join(project.root, "src/index.ts"), ENTRY);
        await expect.poll(observe, poll).toMatchObject({ value: SECOND.toString("hex") });
        expect(observe().pid).not.toBe(replaced.pid);
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});
