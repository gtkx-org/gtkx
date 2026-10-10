import { mkdirSync, mkdtempDisposableSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const workspace = fileURLToPath(new URL("../../..", import.meta.url));
const createProject = (config: Record<string, unknown> = {}) => {
    const directory = mkdtempDisposableSync(join(tmpdir(), "gtkx-cli-test-"));
    const root = directory.path;
    const write = (path: string, content: string) => {
        const target = join(root, path);
        mkdirSync(dirname(target), { recursive: true });
        writeFileSync(target, content);
    };
    mkdirSync(join(root, "node_modules/@gtkx"), { recursive: true });
    for (const name of [
        "cairo",
        "cli",
        "components",
        "config",
        "css",
        "i18n",
        "native",
        "react",
        "runtime",
        "storybook",
        "testing",
        "utils",
        "vitest",
    ]) {
        symlinkSync(join(workspace, "packages", name), join(root, "node_modules/@gtkx", name), "dir");
    }
    for (const name of ["@types", "react", "csstype", "tsx"]) {
        symlinkSync(join(workspace, "node_modules", name), join(root, "node_modules", name), "dir");
    }
    write(
        "package.json",
        JSON.stringify({ name: "cli-example", version: "1.0.0", type: "module", license: "MIT", dependencies: {} }),
    );
    write(
        "gtkx.config.ts",
        `export default ${JSON.stringify({ applicationId: "org.gtkx.example", codegen: false, agents: { reference: false, rules: false }, ...config })};`,
    );
    write("src/index.ts", 'export const greeting = "hello from build";');
    return { root, write, [Symbol.dispose]: () => directory[Symbol.dispose]() };
};

export { createProject };
