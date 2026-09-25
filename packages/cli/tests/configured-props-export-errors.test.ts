import { describe, expect, it } from "vitest";
import { createCliProject, runCli } from "./cli-project.js";
import {
    installConfiguredProps,
    OUTPUT,
    PROPS_MODULE,
    readButton,
    runDocs,
    writePropsConfig,
} from "./configured-props-fixture.js";

const INVALID_PROPS = [
    { title: "a value-only export", module: PROPS_MODULE, exported: "ValueProps" },
    { title: "a function export", module: PROPS_MODULE, exported: "FunctionProps" },
];

describe("configured element prop reference", () => {
    it.each(INVALID_PROPS)("rejects $title without replacing prior pages", ({ module, exported }) => {
        using project = createCliProject({ prefix: "gtkx-props-invalid-" });
        installConfiguredProps(project.root);
        writePropsConfig(project.root);
        runDocs(project);
        const before = readButton(project.root);
        writePropsConfig(project.root, exported, module);
        expect(runCli(project, ["docs", "--out", OUTPUT]).status).not.toBe(0);
        expect(readButton(project.root)).toBe(before);
    });
});
