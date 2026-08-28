import { describe, expect, it } from "vitest";
import { type CliProject, createCliProject, removeCliProject, runCli } from "./cli-project.js";

type CliStreams = { stdout: string; stderr: string };

const APPLICATION_ID = "com.gtkx.clideprecations";
const SUMMARY = "future flags are unset";
const BYTE_ARRAYS = "[gtkx-v2-byte-arrays]";
const INOUT_RETURNS = "[gtkx-v2-inout-returns]";
const GUIDE = "https://gtkx.dev/guide/upgrading-to-2";

const ALL_FLAGS = `future: {
        v2ByteArrays: true,
        v2ValueReturns: true,
        v2FinishResults: true,
        v2InoutReturns: true,
        v2ResourceImports: true,
    },`;

const EVERY_ID = [
    "gtkx-v2-byte-arrays",
    "gtkx-v2-value-returns",
    "gtkx-v2-finish-results",
    "gtkx-v2-inout-returns",
    "gtkx-v2-resource-imports",
];

const configWith = (body: string): string =>
    `export default {\n    applicationId: "${APPLICATION_ID}",\n    codegen: false,\n    ${body}\n};\n`;

const codegenStreams = (body: string, overrides: NodeJS.ProcessEnv = {}): CliStreams => {
    const project: CliProject = createCliProject({
        prefix: "gtkx-cli-deprecations-",
        config: configWith(body),
    });

    try {
        const run = runCli(project, ["codegen"], overrides);
        expect(run.status).toBe(0);

        return { stdout: run.stdout, stderr: run.stderr };
    } finally {
        removeCliProject(project);
    }
};

describe("future flag deprecation warnings", () => {
    it("names every unset flag on stderr and leaves stdout clean", () => {
        const { stdout, stderr } = codegenStreams("");
        expect(stderr).toContain("5 of 5 future flags are unset");
        expect(stderr).toContain(BYTE_ARRAYS);
        expect(stderr).toContain(INOUT_RETURNS);
        expect(stderr).toContain(GUIDE);
        expect(stdout).toBe("");
    });

    it("stays quiet when a parent process already reported the same flags", () => {
        const { stdout, stderr } = codegenStreams("", { GTKX_DEPRECATIONS_SHOWN: EVERY_ID.join(",") });
        expect(`${stdout}${stderr}`).not.toContain(SUMMARY);
    });

    it("reports again when a parent process reported a different set of flags", () => {
        const { stderr } = codegenStreams("", { GTKX_DEPRECATIONS_SHOWN: "gtkx-v2-byte-arrays" });
        expect(stderr).toContain("5 of 5 future flags are unset");
    });

    it("prints the block once even though the command loads the configuration twice", () => {
        const { stderr } = codegenStreams("");
        expect(stderr.split(SUMMARY)).toHaveLength(2);
    });

    it("says nothing when every flag is set", () => {
        const { stdout, stderr } = codegenStreams(ALL_FLAGS);
        expect(`${stdout}${stderr}`).not.toContain(SUMMARY);
    });

    it("reports only the flags that are still unset", () => {
        const { stderr } = codegenStreams("future: { v2ByteArrays: true },");
        expect(stderr).toContain("4 of 5 future flags are unset");
        expect(stderr).not.toContain(BYTE_ARRAYS);
        expect(stderr).toContain(INOUT_RETURNS);
    });

    it("drops a silenced id, keeps reporting the rest, and still counts it as unset", () => {
        const { stderr } = codegenStreams('deprecations: { silence: ["gtkx-v2-byte-arrays"] },');
        expect(stderr).toContain("5 of 5 future flags are unset");
        expect(stderr).toContain("1 of them silenced here");
        expect(stderr).not.toContain(BYTE_ARRAYS);
        expect(stderr).toContain(INOUT_RETURNS);
    });

    it("says nothing when every unset flag is silenced", () => {
        const { stdout, stderr } = codegenStreams(`deprecations: { silence: ${JSON.stringify(EVERY_ID)} },`);
        expect(`${stdout}${stderr}`).not.toContain(SUMMARY);
    });
});
