import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { gtkxReactCompiler } from "../../src/vite-plugins/react-compiler.js";

type TransformResult = { code: string; map?: unknown } | undefined;
type TransformFn = (code: string, id: string) => Promise<TransformResult>;
type ConfigFn = (config: { root?: string }) => Promise<unknown>;
type ConfigResolvedFn = (config: { root: string }) => void;

const isHandler = <F>(hook: unknown): hook is F => typeof hook === "function";

const hookOf = <F>(hook: unknown, name: string): F => {
    if (!isHandler<F>(hook)) throw new Error(`${name} must be a function hook`);
    return hook;
};

const transformOf = (plugin: ReturnType<typeof gtkxReactCompiler>): TransformFn =>
    hookOf<TransformFn>(plugin.transform, "transform");
const configOf = (plugin: ReturnType<typeof gtkxReactCompiler>): ConfigFn => hookOf<ConfigFn>(plugin.config, "config");
const configResolvedOf = (plugin: ReturnType<typeof gtkxReactCompiler>): ConfigResolvedFn =>
    hookOf<ConfigResolvedFn>(plugin.configResolved, "configResolved");

const HOOK = `import { useState } from "react";
export function useCounter(initial: number) {
    const [count, setCount] = useState(initial);
    const increment = () => setCount((c) => c + 1);
    return { count, increment };
}
`;

const COMPONENT = `export function Counter({ label }: { label: string }) {
    const [n, setN] = React.useState(0);
    return <button onClicked={() => setN(n + 1)}>{label}: {n}</button>;
}
`;

describe("gtkxReactCompiler", () => {
    it("returns a plugin with the expected name and pre-enforce", () => {
        const plugin = gtkxReactCompiler();
        expect(plugin.name).toBe("gtkx:react-compiler");
        expect(plugin.enforce).toBe("pre");
    });

    it("compiles a project source file, injecting the memo cache and compiler runtime", async () => {
        const transform = transformOf(gtkxReactCompiler());
        const result = await transform(COMPONENT, "/proj/src/counter.tsx");

        expect(result).toBeDefined();
        expect(result?.code).toContain('from "react/compiler-runtime"');
        expect(result?.code).toContain("_c(");
        expect(result?.map).toBeDefined();
    });

    it("strips TypeScript while leaving JSX for the downstream transform", async () => {
        const transform = transformOf(gtkxReactCompiler());
        const result = await transform(COMPONENT, "/proj/src/counter.tsx");

        expect(result?.code).not.toContain(": { label: string }");
        expect(result?.code).toContain("<button");
    });

    it("skips files that are not .ts or .tsx", async () => {
        const transform = transformOf(gtkxReactCompiler());
        await expect(transform("body { color: red; }", "/proj/src/styles.css")).resolves.toBeUndefined();
    });

    it("skips files in node_modules", async () => {
        const transform = transformOf(gtkxReactCompiler());
        await expect(transform(COMPONENT, "/proj/node_modules/lib/counter.tsx")).resolves.toBeUndefined();
    });

    it("skips files outside the resolved project root", async () => {
        const plugin = gtkxReactCompiler();
        configResolvedOf(plugin)({ root: "/proj" });
        const transform = transformOf(plugin);

        await expect(transform(COMPONENT, "/elsewhere/src/counter.tsx")).resolves.toBeUndefined();
        await expect(transform(COMPONENT, "/proj/src/counter.tsx")).resolves.toBeDefined();
    });

    it("compiles .ts source files, not only .tsx", async () => {
        const transform = transformOf(gtkxReactCompiler());
        const result = await transform(HOOK, "/proj/src/use-counter.ts");

        expect(result).toBeDefined();
        expect(result?.code).not.toContain(": number");
        expect(result?.code).toContain('from "react/compiler-runtime"');
    });

    it("skips query-suffixed ids such as ?raw asset-text imports", async () => {
        const transform = transformOf(gtkxReactCompiler());
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
        writeFileSync(join(cwd, "gtkx.config.ts"), `export default { reactCompiler: false };\n`);

        const plugin = gtkxReactCompiler();
        await configOf(plugin)({ root: cwd });
        configResolvedOf(plugin)({ root: cwd });

        const transform = transformOf(plugin);
        await expect(transform(COMPONENT, join(cwd, "src/counter.tsx"))).resolves.toBeUndefined();
    });

    it("transforms when the project enables the compiler explicitly", async () => {
        writeFileSync(join(cwd, "gtkx.config.ts"), `export default { reactCompiler: true };\n`);

        const plugin = gtkxReactCompiler();
        await configOf(plugin)({ root: cwd });
        configResolvedOf(plugin)({ root: cwd });

        const transform = transformOf(plugin);
        const result = await transform(COMPONENT, join(cwd, "src/counter.tsx"));
        expect(result?.code).toContain('from "react/compiler-runtime"');
    });
});
