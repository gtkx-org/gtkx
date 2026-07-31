import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gtkxReactCompiler } from "../../src/vite-plugins/react-compiler.js";

type TransformResult = { code: string; map?: unknown } | undefined;
type TransformFn = (code: string, id: string) => Promise<TransformResult>;
type ConfigFn = (config: { root?: string }) => Promise<unknown>;
type ConfigResolvedFn = (config: { root: string }) => void;

type PluginHooks = {
    transform: TransformFn;
    config: ConfigFn;
    configResolved: ConfigResolvedFn;
};

const HOOK = `import { useState } from "react";
export function useCounter(initial: number) {
    const [count, setCount] = useState(initial);
    const increment = () => setCount((c) => c + 1);
    return { count, increment };
}
`;

const COUNTER_CHILDREN = "{label}: {n}";

const COMPONENT = `export function Counter({ label }: { label: string }) {
    const [n, setN] = React.useState(0);
    return <button onClicked={() => setN(n + 1)}>${COUNTER_CHILDREN}</button>;
}
`;

const JS_COMPONENT = `export function Counter({ label }) {
    const [n, setN] = React.useState(0);
    return <button onClicked={() => setN(n + 1)}>${COUNTER_CHILDREN}</button>;
}
`;

const JS_HOOK = `import { useState } from "react";
export function useCounter(initial) {
    const [count, setCount] = useState(initial);
    return { count, increment: () => setCount((c) => c + 1) };
}
`;

const getHook = <K extends keyof PluginHooks>(hook: unknown, name: K): PluginHooks[K] => {
    if (typeof hook !== "function") {
        throw new TypeError(`${name} must be a function hook`);
    }

    return hook as PluginHooks[K];
};

const getTransform = (plugin: ReturnType<typeof gtkxReactCompiler>): TransformFn =>
    getHook(plugin.transform, "transform");

const getConfig = (plugin: ReturnType<typeof gtkxReactCompiler>): ConfigFn => getHook(plugin.config, "config");

const getConfigResolved = (plugin: ReturnType<typeof gtkxReactCompiler>): ConfigResolvedFn =>
    getHook(plugin.configResolved, "configResolved");

const enabledPlugin = async (): Promise<ReturnType<typeof gtkxReactCompiler>> => {
    const plugin = gtkxReactCompiler({
        load: () =>
            Promise.resolve({
                config: { applicationId: "org.gtk.Test" },
                configFile: "gtkx.config.ts",
                root: process.cwd(),
            }),
        resolve: () =>
            Promise.resolve({
                applicationId: "org.gtk.Test",
                reactCompiler: { target: "19" },
                userEventSignals: {},
                elements: null,
                lazyElements: [],
            }),
    });

    await getConfig(plugin)({});

    return plugin;
};

const transformWithEnabledPlugin = async (code: string, id: string): Promise<TransformResult> =>
    getTransform(await enabledPlugin())(code, id);

const transformForProjectConfig = async (cwd: string, isCompilerEnabled: boolean): Promise<TransformFn> => {
    writeFileSync(
        join(cwd, "gtkx.config.ts"),
        `export default { applicationId: "org.gtk.Test", reactCompiler: ${String(isCompilerEnabled)} };\n`,
    );

    const plugin = gtkxReactCompiler();
    await getConfig(plugin)({ root: cwd });
    getConfigResolved(plugin)({ root: cwd });

    return getTransform(plugin);
};

describe("gtkxReactCompiler (plugin shape)", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxReactCompiler();
        expect(plugin.name).toBe("gtkx:react-compiler");
        expect(plugin.enforce).toBe("pre");
    });
});

describe("gtkxReactCompiler (compilation)", () => {
    it("compiles a project source file, injecting the memo cache and compiler runtime", async () => {
        const result = await transformWithEnabledPlugin(COMPONENT, "/proj/src/counter.tsx");
        expect(result).toBeDefined();
        expect(result?.code).toContain('from "react/compiler-runtime"');
        expect(result?.code).toContain("_c(");
        expect(result?.map).toBeDefined();
    });

    it("strips TypeScript while leaving JSX for the downstream transform", async () => {
        const result = await transformWithEnabledPlugin(COMPONENT, "/proj/src/counter.tsx");
        expect(result?.code).not.toContain(": { label: string }");
        expect(result?.code).toContain("<button");
    });

    it("compiles a .jsx source file, injecting the memo cache and compiler runtime", async () => {
        const result = await transformWithEnabledPlugin(JS_COMPONENT, "/proj/src/counter.jsx");
        expect(result).toBeDefined();
        expect(result?.code).toContain('from "react/compiler-runtime"');
        expect(result?.code).toContain("_c(");
        expect(result?.code).toContain("<button");
    });

    it("compiles a plain .js hook module", async () => {
        const result = await transformWithEnabledPlugin(JS_HOOK, "/proj/src/use-counter.js");
        expect(result).toBeDefined();
        expect(result?.code).toContain('from "react/compiler-runtime"');
    });

    it("compiles JSX authored in a plain .js file", async () => {
        const result = await transformWithEnabledPlugin(JS_COMPONENT, "/proj/src/widget.js");
        expect(result).toBeDefined();
        expect(result?.code).toContain('from "react/compiler-runtime"');
        expect(result?.code).toContain("<button");
    });

    it("compiles .ts source files, not only .tsx", async () => {
        const result = await transformWithEnabledPlugin(HOOK, "/proj/src/use-counter.ts");
        expect(result).toBeDefined();
        expect(result?.code).not.toContain(": number");
        expect(result?.code).toContain('from "react/compiler-runtime"');
    });
});

describe("gtkxReactCompiler (skipped inputs)", () => {
    it("skips files without a script extension", async () => {
        const transform = getTransform(gtkxReactCompiler());
        await expect(transform("body { color: red; }", "/proj/src/styles.css")).resolves.toBeUndefined();
    });

    it("skips files in node_modules", async () => {
        const transform = getTransform(gtkxReactCompiler());
        await expect(transform(COMPONENT, "/proj/node_modules/lib/counter.tsx")).resolves.toBeUndefined();
    });

    it("skips files outside the resolved project root", async () => {
        const plugin = await enabledPlugin();
        getConfigResolved(plugin)({ root: "/proj" });
        const transform = getTransform(plugin);
        await expect(transform(COMPONENT, "/elsewhere/src/counter.tsx")).resolves.toBeUndefined();
        await expect(transform(COMPONENT, "/proj/src/counter.tsx")).resolves.toBeDefined();
    });

    it("skips query-suffixed ids such as ?raw asset-text imports", async () => {
        const transform = getTransform(gtkxReactCompiler());
        await expect(transform(COMPONENT, "/proj/src/counter.tsx?raw")).resolves.toBeUndefined();
    });
});

describe("gtkxReactCompiler (config-driven enable/disable)", () => {
    let cwd: string;

    beforeEach(() => {
        cwd = mkdtempSync(join(tmpdir(), "gtkx-react-compiler-"));
    });

    afterEach(() => {
        rmSync(cwd, { recursive: true, force: true });
    });

    it("does not transform when the project disables the compiler", async () => {
        const transform = await transformForProjectConfig(cwd, false);
        await expect(transform(COMPONENT, join(cwd, "src/counter.tsx"))).resolves.toBeUndefined();
    });

    it("transforms when the project enables the compiler explicitly", async () => {
        const transform = await transformForProjectConfig(cwd, true);
        const result = await transform(COMPONENT, join(cwd, "src/counter.tsx"));
        expect(result?.code).toContain('from "react/compiler-runtime"');
    });
});
