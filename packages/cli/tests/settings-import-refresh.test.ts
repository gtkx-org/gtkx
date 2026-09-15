import { once } from "node:events";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, it } from "vitest";
import { createCliProject, startCli } from "./cli-project.js";

type Observation = {
    phase: string;
    pid: number;
    publishedAt: number;
    state: string;
    schemas: Record<string, string | null>;
};

const NAMES = ["First", "Second", "Third", "Fourth"];
const APP_FILE = "src/app.tsx";
const OBSERVATION_FILE = "observation.json";
const CHILD_FILE = "src/child.tsx";
const CHILD_OBSERVATION_FILE = "child.json";
const RELOAD_TIMEOUT = 60_000;
const INVALID_SETTLE_MS = 2000;
const ENTRY = `import { createRoot } from "@gtkx/react";
import { App } from "./app.js";
createRoot().render(<App />);
`;

const schemaFile = (name: string): string => `data/${name.toLowerCase()}.gschema.xml`;

const schema = (name: string, value = name): string =>
    `<schemalist><schema id="org.gtkx.ImportRefresh${name}" ` +
    `path="/org/gtkx/import-refresh/${name.toLowerCase()}/"><key name="value" type="s">` +
    `<default>'${value}'</default></key></schema></schemalist>`;

const component = (phase: string, schemas: string[], isApplication = true): string => {
    const observationFile = isApplication ? OBSERVATION_FILE : CHILD_OBSERVATION_FILE;

    return `
import { AdwApplication, AdwApplicationWindow } from "@gtkx/jsx/adw";
import { GtkLabel } from "@gtkx/jsx/gtk";
import * as Gio from "@gtkx/gi/gio";
import { useEffect, useState } from "react";
import { renameSync, writeFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
${schemas.map((name) => `import "../${schemaFile(name)}";`).join("\n")}
${isApplication ? 'import { Child } from "./child.js";' : ""}

export function ${isApplication ? "App" : "Child"}() {
    const [state] = useState(() => randomUUID());
    useEffect(() => {
        const publish = () => {
            const source = Gio.SettingsSchemaSource.getDefault();
            const schemas = Object.fromEntries(${JSON.stringify(NAMES)}.map((name) => [
                name,
                source?.lookup("org.gtkx.ImportRefresh" + name, true)
                    ?.getKey("value").getDefaultValue().getString()[0] ?? null,
            ]));
            writeFileSync("${observationFile}.pending", JSON.stringify({
                phase: ${JSON.stringify(phase)}, pid: process.pid, publishedAt: Date.now(), state, schemas,
            }));
            renameSync("${observationFile}.pending", "${observationFile}");
        };
        publish();
        const timer = setInterval(publish, 100);
        return () => clearInterval(timer);
    });
    return ${isApplication
        ? "<AdwApplication>" +
        '<AdwApplicationWindow title="Schema refresh" defaultWidth={320} defaultHeight={160}>' +
        "<Child /></AdwApplicationWindow></AdwApplication>"
        : `<GtkLabel label=${JSON.stringify(phase)} />`};
}
`;
};

const expectedSchemas = (selected: string[]): Record<string, string | null> =>
    Object.fromEntries(NAMES.map((name) => [name, selected.includes(name) ? name : null]));

it("restarts for changed schema imports while preserving ordinary refresh and recovering invalid edits", async () => {
    using project = createCliProject({
        prefix: "gtkx-settings-import-refresh-",
        config: 'export default { applicationId: "org.gtkx.settingsimportrefresh", codegen: false };',
        hasStore: true,
        files: {
            ...Object.fromEntries(NAMES.map((name) => [schemaFile(name), schema(name)])),
            "src/index.tsx": ENTRY,
            [APP_FILE]: component("initial", ["First"]),
            [CHILD_FILE]: component("child-initial", [], false),
        },
    });
    const child = startCli(project, ["dev", "--headless"], { GSETTINGS_BACKEND: "memory" });
    const closed = once(child, "close");
    child.stdout?.resume();
    child.stderr?.resume();
    const observe = (): Observation =>
        JSON.parse(readFileSync(join(project.root, OBSERVATION_FILE), "utf8")) as Observation;
    const observeChild = (): Observation =>
        JSON.parse(readFileSync(join(project.root, CHILD_OBSERVATION_FILE), "utf8")) as Observation;
    const writeComponent = (phase: string, schemas: string[]): void => {
        writeFileSync(join(project.root, APP_FILE), component(phase, schemas));
    };
    const observedPhase = async (phase: string): Promise<Observation> => {
        await expect.poll(observe, { timeout: RELOAD_TIMEOUT }).toMatchObject({ phase });

        return observe();
    };
    const expectPreserved = async (previous: Observation): Promise<void> => {
        const invalidUntil = Date.now() + INVALID_SETTLE_MS;
        await expect.poll(() => observe().publishedAt, { timeout: RELOAD_TIMEOUT }).toBeGreaterThan(invalidUntil);
        expect(observe()).toMatchObject({
            phase: previous.phase,
            pid: previous.pid,
            state: previous.state,
            schemas: previous.schemas,
        });
    };

    try {
        const initial = await observedPhase("initial");
        expect(initial.schemas).toEqual(expectedSchemas(["First"]));
        await expect.poll(observeChild, { timeout: RELOAD_TIMEOUT }).toMatchObject({ phase: "child-initial" });
        const initialChild = observeChild();
        writeComponent("ordinary", ["First"]);
        const ordinary = await observedPhase("ordinary");
        expect(ordinary.pid).toBe(initial.pid);
        expect(ordinary.state).toBe(initial.state);
        writeFileSync(join(project.root, APP_FILE), `${component("invalid-source", ["First"])}\nconst =`);
        await expectPreserved(ordinary);
        for (const phase of ["child-first-edit", "child-second-edit"]) {
            writeFileSync(join(project.root, CHILD_FILE), component(phase, [], false));
            await expect.poll(observeChild, { timeout: RELOAD_TIMEOUT }).toMatchObject({ phase });
            expect(observeChild()).toMatchObject({
                pid: initialChild.pid,
                state: initialChild.state,
                schemas: initialChild.schemas,
            });
            await expectPreserved(ordinary);
        }
        writeComponent("source-recovered", ["First"]);
        const recovered = await observedPhase("source-recovered");
        expect(recovered.pid).toBe(initial.pid);
        expect(recovered.state).toBe(initial.state);
        writeFileSync(join(project.root, CHILD_FILE), component("child-with-schema", ["Second"], false));
        await expect.poll(observe, { timeout: RELOAD_TIMEOUT }).toMatchObject({
            schemas: expectedSchemas(["First", "Second"]),
        });
        const withChildSchema = observe();
        expect(withChildSchema.pid).not.toBe(recovered.pid);
        await expect.poll(observeChild, { timeout: RELOAD_TIMEOUT }).toMatchObject({ phase: "child-with-schema" });
        const childBeforeXml = observeChild();
        writeFileSync(join(project.root, APP_FILE), `${component("invalid-xml-source", ["First"])}\nconst =`);
        await expectPreserved(withChildSchema);
        writeFileSync(join(project.root, schemaFile("Second")), schema("Second", "Second updated"));
        await expectPreserved(withChildSchema);
        writeFileSync(join(project.root, CHILD_FILE), component("child-after-xml", ["Second"], false));
        await expect.poll(observeChild, { timeout: RELOAD_TIMEOUT }).toMatchObject({ phase: "child-after-xml" });
        expect(observeChild()).toMatchObject({ pid: childBeforeXml.pid, state: childBeforeXml.state });
        writeComponent("xml-source-recovered", ["First"]);
        const xmlSourceRecovered = await observedPhase("xml-source-recovered");
        expect(xmlSourceRecovered.pid).not.toBe(withChildSchema.pid);
        expect(xmlSourceRecovered.schemas).toEqual({
            ...expectedSchemas(["First", "Second"]),
            Second: "Second updated",
        });
        await expectPreserved(xmlSourceRecovered);
        writeFileSync(join(project.root, CHILD_FILE), component("child-no-schema", [], false));
        await expect.poll(observe, { timeout: RELOAD_TIMEOUT }).toMatchObject({ schemas: expectedSchemas(["First"]) });
        const beforeAddition = observe();
        expect(beforeAddition.pid).not.toBe(xmlSourceRecovered.pid);
        writeFileSync(join(project.root, schemaFile("Second")), schema("Second"));
        writeComponent("added", ["First", "Second"]);
        const added = await observedPhase("added");
        expect(added.pid).not.toBe(beforeAddition.pid);
        expect(added.schemas).toEqual(expectedSchemas(["First", "Second"]));
        writeComponent("replaced", ["First", "Third"]);
        const replaced = await observedPhase("replaced");
        expect(replaced.pid).not.toBe(added.pid);
        expect(replaced.schemas).toEqual(expectedSchemas(["First", "Third"]));
        const invalidFile = join(project.root, schemaFile("Fourth"));
        writeFileSync(invalidFile, '<schemalist><schema id="org.gtkx.ImportRefreshFourth">');
        writeComponent("xml-recovered", ["First", "Third", "Fourth"]);
        await expectPreserved(replaced);
        writeFileSync(invalidFile, schema("Fourth"));
        const xmlRecovered = await observedPhase("xml-recovered");
        expect(xmlRecovered.pid).not.toBe(replaced.pid);
        expect(xmlRecovered.schemas).toEqual(expectedSchemas(["First", "Third", "Fourth"]));
        writeComponent("removed", []);
        const removed = await observedPhase("removed");
        expect(removed.pid).not.toBe(xmlRecovered.pid);
        expect(removed.schemas).toEqual(expectedSchemas([]));
    } finally {
        child.kill("SIGTERM");
        await closed;
    }
});
