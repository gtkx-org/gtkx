import { resolveGirPath, runCodegen } from "@gtkx/codegen";
import { resolveExecutable } from "@gtkx/utils";
import { execFile } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from "node:fs";
import { delimiter, dirname, join, resolve } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

type ScenarioName = "edge" |
    "fullPodContainer" |
    "gerror" |
    "happy" |
    "inoutTransferFull" |
    "invalidFlatPodArray" |
    "invalidInlinePodArray" |
    "lifecycleTransferFull" |
    "opaqueContainer" |
    "outputCleanup" |
    "transferFull" |
    "transferFullReturn" |
    "unknownCallerAllocated";

type ConformanceHarness = {
    dispose: () => void;
    runGjs: (scenario: ScenarioName) => Promise<unknown>;
    runGtkx: (scenario: ScenarioName) => Promise<unknown>;
};

type CommandOptions = {
    env?: NodeJS.ProcessEnv;
};

const RESULT_MARKER = "GTKX_CONFORMANCE_RESULT:";
const FULL_RETURN_FUNCTIONS = ["create_full_pod", "get_null_full_pod"];
const FULL_PARAMETER_FUNCTIONS = [{ functionName: "replace_pod_full", parameterName: "pod" }];
const FUNCTION_END = "    </function>";
const fixtureDir = resolve(dirname(fileURLToPath(import.meta.url)), "../fixtures/gjs-conformance");
const e2eDir = resolve(fixtureDir, "../../..");

const runCommand = (command: string, args: string[], options: CommandOptions = {}): Promise<string> =>
    new Promise<string>((resolve, reject) => {
        execFile(
            command,
            args,
            {
                encoding: "utf8",
                env: options.env,
                maxBuffer: 16 * 1024 * 1024,
            },
            (error, stdout, stderr) => {
                if (error !== null) {
                    reject(new Error(`${command} failed:\n${stdout}${stderr}`, { cause: error }));

                    return;
                }

                resolve(`${stdout}${stderr}`);
            },
        );
    });

const prependSearchPath = (directory: string, existing: string | undefined): string =>
    existing === undefined || existing.length === 0 ? directory : `${directory}${delimiter}${existing}`;

const runtimeEnv = (buildDir: string): NodeJS.ProcessEnv => ({
    ...process.env,
    GI_TYPELIB_PATH: prependSearchPath(buildDir, process.env.GI_TYPELIB_PATH),
    LD_LIBRARY_PATH: prependSearchPath(buildDir, process.env.LD_LIBRARY_PATH),
});

const parseResult = (output: string): unknown => {
    const marked = output
        .split("\n")
        .map((line) => line.trim())
        .find((line) => line.includes(RESULT_MARKER));

    if (marked === undefined) {
        throw new Error(`Conformance runner produced no result:\n${output}`);
    }

    const markerPosition = marked.indexOf(RESULT_MARKER);
    const parsed: unknown = JSON.parse(marked.slice(markerPosition + RESULT_MARKER.length));

    return parsed;
};

const normalizeFullReturnDeclaration = (source: string, functionName: string): string => {
    const functionStart = source.indexOf(`    <function name="${functionName}"`);
    const functionEnd = source.indexOf(FUNCTION_END, functionStart);

    if (functionStart === -1 || functionEnd === -1) {
        throw new Error(`The scanner omitted ${functionName} from the conformance GIR`);
    }

    const declarationEnd = functionEnd + FUNCTION_END.length;
    const declaration = source.slice(functionStart, declarationEnd);
    const normalized = declaration.replace('transfer-ownership="none"', 'transfer-ownership="full"');

    if (normalized === declaration) {
        throw new Error(`The ${functionName} return ownership could not be normalized`);
    }

    return `${source.slice(0, functionStart)}${normalized}${source.slice(declarationEnd)}`;
};

const normalizeFullParameterDeclaration = (
    source: string,
    functionName: string,
    parameterName: string,
): string => {
    const functionStart = source.indexOf(`    <function name="${functionName}"`);
    const functionEnd = source.indexOf(FUNCTION_END, functionStart);
    const parameterStart = source.indexOf(`<parameter name="${parameterName}"`, functionStart);
    const parameterEnd = source.indexOf("</parameter>", parameterStart);

    if (
        functionStart === -1 ||
        functionEnd === -1 ||
        parameterStart === -1 ||
        parameterEnd === -1 ||
        parameterStart > functionEnd ||
        parameterEnd > functionEnd
    ) {
        throw new Error(`The scanner omitted ${functionName}.${parameterName} from the conformance GIR`);
    }

    const declarationEnd = parameterEnd + "</parameter>".length;
    const declaration = source.slice(parameterStart, declarationEnd);
    const normalized = declaration.replace('transfer-ownership="none"', 'transfer-ownership="full"');

    if (normalized === declaration) {
        throw new Error(`The ${functionName}.${parameterName} ownership could not be normalized`);
    }

    return `${source.slice(0, parameterStart)}${normalized}${source.slice(declarationEnd)}`;
};

const normalizeOwnership = (buildDir: string): { gir: string; typelib: string } => {
    const gir = join(buildDir, "GtkxConformance-1.0.gir");
    const typelib = join(buildDir, "GtkxConformance-1.0.typelib");
    let source = readFileSync(gir, "utf8");

    for (const functionName of FULL_RETURN_FUNCTIONS) {
        source = normalizeFullReturnDeclaration(source, functionName);
    }

    for (const { functionName, parameterName } of FULL_PARAMETER_FUNCTIONS) {
        source = normalizeFullParameterDeclaration(source, functionName, parameterName);
    }

    writeFileSync(gir, source);

    return { gir, typelib };
};

const createGjsConformanceHarness = async (): Promise<ConformanceHarness> => {
    const gjs = resolveExecutable("gjs");
    const girCompiler = resolveExecutable("g-ir-compiler");
    const meson = resolveExecutable("meson");
    const scratchParent = join(e2eDir, "node_modules", ".gtkx");
    mkdirSync(scratchParent, { recursive: true });
    const scratchDir = mkdtempSync(join(scratchParent, "gjs-conformance-"));
    const buildDir = join(scratchDir, "build");

    try {
        await runCommand(meson, ["setup", buildDir, fixtureDir, "--buildtype=debugoptimized"]);
        await runCommand(meson, ["compile", "-C", buildDir]);
        const normalized = normalizeOwnership(buildDir);
        const normalizedTypelib = `${normalized.typelib}.normalized`;
        await runCommand(girCompiler, [normalized.gir, `--output=${normalizedTypelib}`]);
        renameSync(normalizedTypelib, normalized.typelib);
        const storeDir = join(scratchDir, "gi");

        await runCodegen({
            gi: {
                linkDir: join(scratchDir, "node_modules", "@gtkx", "gi"),
                storeDir,
                version: "0.0.0",
            },
            girPath: resolveGirPath([buildDir]),
            isForced: true,
            libraries: ["GtkxConformance-1.0"],
        });

        const env = runtimeEnv(buildDir);
        const gjsRunner = join(fixtureDir, "gjs-runner.mjs");
        const gtkxRunner = join(fixtureDir, "gtkx-runner.mjs");
        const moduleUrl = pathToFileURL(join(storeDir, "gtkxconformance", "index.js")).href;

        return {
            dispose: () => {
                rmSync(scratchDir, { force: true, recursive: true });
            },
            runGjs: async (scenario) => parseResult(await runCommand(gjs, ["-m", gjsRunner, scenario], { env })),
            runGtkx: async (scenario) =>
                parseResult(
                    await runCommand(process.execPath, [gtkxRunner, scenario], {
                        env: { ...env, GTKX_CONFORMANCE_MODULE_URL: moduleUrl },
                    }),
                ),
        };
    } catch (error) {
        rmSync(scratchDir, { force: true, recursive: true });
        throw error;
    }
};

export { createGjsConformanceHarness, type ConformanceHarness };
