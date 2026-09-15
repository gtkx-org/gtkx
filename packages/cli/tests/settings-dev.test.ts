import { once } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createCliProject, startCli } from "./cli-project.js";

type Observation = {
    pid: number;
    publishedAt: number;
    base: { keys: Record<string, string> };
    child: { keys: Record<string, string> };
    value: string;
};

const BASE_FILE = "data/base.gschema.xml";
const OBSERVATION_FILE = "observation.json";
const RELOAD_TIMEOUT = 60_000;
const INVALID_SETTLE_MS = 2000;
const CHILD_SCHEMA = '<schemalist><schema id="org.gtkx.Child" extends="org.gtkx.Base" path="/org/gtkx/child/">' +
    '<key name="own" type="b"><default>true</default></key></schema></schemalist>';
const INITIAL_KEYS = { shared: "s", own: "b" };
const UPDATED_KEYS = { ...INITIAL_KEYS, added: "i" };
const ENTRY = `import * as Gio from "@gtkx/gi/gio";
import { renameSync, writeFileSync } from "node:fs";
import base from "../data/base.gschema.xml";
import child from "../data/child.gschema.xml";

const schema = Gio.SettingsSchemaSource.getDefault()?.lookup(child.id, true);
if (schema == null) throw new Error("Schema unavailable");
const publish = () => {
    writeFileSync("${OBSERVATION_FILE}.pending", JSON.stringify({
        pid: process.pid,
        publishedAt: Date.now(),
        base,
        child,
        value: schema.getKey("shared").getDefaultValue().getString()[0],
    }));
    renameSync("${OBSERVATION_FILE}.pending", "${OBSERVATION_FILE}");
};
publish();
setInterval(publish, 100);
`;

const baseSchema = (value: string, hasExtraKey = false): string =>
    '<schemalist><schema id="org.gtkx.Base"><key name="shared" type="s">' +
    `<default>'${value}'</default></key>` +
    (hasExtraKey ? '<key name="added" type="i"><default>7</default></key>' : "") +
    "</schema></schemalist>";

it("restarts for schema changes, preserves a running app after invalid XML, and recovers after a fix", async () => {
    using project = createCliProject({
        prefix: "gtkx-settings-dev-",
        config: 'export default { applicationId: "org.gtkx.settingsdev", codegen: false };',
        hasStore: true,
        files: {
            [BASE_FILE]: baseSchema("initial"),
            "data/child.gschema.xml": CHILD_SCHEMA,
            "src/index.ts": ENTRY,
        },
    });
    const child = startCli(project, ["dev", "--headless"], { GSETTINGS_BACKEND: "memory" });
    const closed = once(child, "close");
    child.stdout?.resume();
    child.stderr?.resume();
    const observationPath = join(project.root, OBSERVATION_FILE);
    const observe = (): Observation => JSON.parse(readFileSync(observationPath, "utf8")) as Observation;

    try {
        await expect.poll(observe, { timeout: RELOAD_TIMEOUT }).toMatchObject({
            base: { keys: { shared: "s" } },
            child: { keys: INITIAL_KEYS },
            value: "initial",
        });
        const first = observe();
        writeFileSync(join(project.root, BASE_FILE), baseSchema("updated", true));

        await expect.poll(observe, { timeout: RELOAD_TIMEOUT }).toMatchObject({
            base: { keys: { shared: "s", added: "i" } },
            child: { keys: UPDATED_KEYS },
            value: "updated",
        });
        const updated = observe();
        expect(updated.pid).not.toBe(first.pid);
        const invalidUntil = Date.now() + INVALID_SETTLE_MS;
        writeFileSync(join(project.root, BASE_FILE), '<schemalist><schema id="org.gtkx.Base">');

        await expect.poll(() => observe().publishedAt, { timeout: RELOAD_TIMEOUT }).toBeGreaterThan(invalidUntil);
        const preserved = observe();
        expect(preserved.pid).toBe(updated.pid);
        expect(preserved.child.keys).toEqual(UPDATED_KEYS);
        expect(preserved.value).toBe("updated");
        writeFileSync(join(project.root, BASE_FILE), baseSchema("recovered"));

        await expect.poll(observe, { timeout: RELOAD_TIMEOUT }).toMatchObject({ value: "recovered" });
        const recovered = observe();
        expect(recovered.pid).not.toBe(updated.pid);
        expect(recovered.base.keys).toEqual({ shared: "s" });
        expect(recovered.child.keys).toEqual(INITIAL_KEYS);
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});
