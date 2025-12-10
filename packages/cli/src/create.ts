import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";

export type PackageManager = "pnpm" | "npm" | "yarn" | "bun";
export type TestingFramework = "vitest" | "jest" | "node" | "none";

export interface CreateOptions {
    name?: string;
    appId?: string;
    packageManager?: PackageManager;
    testing?: TestingFramework;
}

const DEPENDENCIES = ["@gtkx/css", "@gtkx/ffi", "@gtkx/react", "react"];

const DEV_DEPENDENCIES = ["@gtkx/cli", "@types/react", "typescript"];

const TESTING_DEV_DEPENDENCIES: Record<Exclude<TestingFramework, "none">, string[]> = {
    vitest: ["@gtkx/testing", "vitest"],
    jest: ["@gtkx/testing", "jest", "@types/jest", "ts-jest"],
    node: ["@gtkx/testing", "@types/node"],
};

export const getTestScript = (testing: TestingFramework): string | undefined => {
    switch (testing) {
        case "vitest":
            return "GDK_BACKEND=x11 xvfb-run -a vitest";
        case "jest":
            return "GDK_BACKEND=x11 xvfb-run -a jest";
        case "node":
            return "GDK_BACKEND=x11 xvfb-run -a node --import tsx --test tests/**/*.test.ts";
        case "none":
            return undefined;
    }
};

export const generatePackageJson = (name: string, appId: string, testing: TestingFramework): string => {
    const testScript = getTestScript(testing);
    const scripts: Record<string, string> = {
        dev: "gtkx dev src/app.tsx",
        build: "tsc -b",
        start: "node dist/index.js",
    };

    if (testScript) {
        scripts.test = testScript;
    }

    return JSON.stringify(
        {
            name,
            version: "0.0.1",
            private: true,
            type: "module",
            scripts,
            gtkx: {
                appId,
            },
        },
        null,
        4,
    );
};

export const generateTsConfig = (): string => {
    return JSON.stringify(
        {
            compilerOptions: {
                target: "ESNext",
                module: "NodeNext",
                moduleResolution: "NodeNext",
                jsx: "react-jsx",
                strict: true,
                skipLibCheck: true,
                outDir: "dist",
                rootDir: "src",
            },
            include: ["src/**/*"],
        },
        null,
        4,
    );
};

const generateAppTsx = (name: string, appId: string): string => {
    const title = name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return `import { useState } from "react";
import * as Gtk from "@gtkx/ffi/gtk";
import { ApplicationWindow, Box, Button, Label, quit } from "@gtkx/react";

export default function App() {
    const [count, setCount] = useState(0);

    return (
        <ApplicationWindow title="${title}" defaultWidth={400} defaultHeight={300} onCloseRequest={quit}>
            <Box orientation={Gtk.Orientation.VERTICAL} spacing={20} marginTop={40} marginStart={40} marginEnd={40}>
                <Label.Root label="Welcome to GTKX!" />
                <Label.Root label={\`Count: \${count}\`} />
                <Button label="Increment" onClicked={() => setCount((c) => c + 1)} />
            </Box>
        </ApplicationWindow>
    );
}

export const appId = "${appId}";
`;
};

const generateIndexTsx = (): string => {
    return `import { render } from "@gtkx/react";
import App, { appId } from "./app.js";

render(<App />, appId);
`;
};

const generateGitignore = (): string => {
    return `node_modules/
dist/
*.log
.DS_Store
`;
};

const generateExampleTest = (testing: TestingFramework): string => {
    const imports =
        testing === "vitest"
            ? `import { describe, it, expect, afterEach } from "vitest";`
            : testing === "jest"
              ? `import { describe, it, expect, afterEach } from "@jest/globals";`
              : `import { describe, it, after } from "node:test";
import { strict as assert } from "node:assert";`;

    const afterEachFn = testing === "node" ? "after" : "afterEach";
    const assertion =
        testing === "node" ? `assert.ok(button, "Button should be rendered");` : `expect(button).toBeDefined();`;

    return `${imports}
import { AccessibleRole } from "@gtkx/ffi/gtk";
import { cleanup, render, screen } from "@gtkx/testing";
import App from "../src/app.js";

${afterEachFn}(async () => {
    await cleanup();
});

describe("App", () => {
    it("renders the increment button", async () => {
        await render(<App />, { wrapper: false });
        const button = await screen.findByRole(AccessibleRole.BUTTON, { name: "Increment" });
        ${assertion}
    });
});
`;
};

const generateVitestConfig = (): string => {
    return `import { defineConfig } from "vitest/config";

export default defineConfig({
    test: {
        include: ["tests/**/*.test.{ts,tsx}"],
        globals: false,
    },
    esbuild: {
        jsx: "automatic",
    },
});
`;
};

const generateJestConfig = (): string => {
    return `/** @type {import('jest').Config} */
export default {
    preset: "ts-jest/presets/default-esm",
    testEnvironment: "node",
    testMatch: ["**/tests/**/*.test.ts"],
    extensionsToTreatAsEsm: [".ts", ".tsx"],
    moduleNameMapper: {
        "^(\\\\.{1,2}/.*)\\\\.js$": "$1",
    },
    transform: {
        "^.+\\\\.tsx?$": [
            "ts-jest",
            {
                useESM: true,
                tsconfig: "tsconfig.json",
            },
        ],
    },
};
`;
};

export const getAddCommand = (pm: PackageManager, deps: string[], dev: boolean): string => {
    const devFlag = dev ? (pm === "npm" ? "--save-dev" : "-D") : "";
    const packages = deps.join(" ");

    switch (pm) {
        case "npm":
            return `npm install ${devFlag} ${packages}`.trim();
        case "yarn":
            return `yarn add ${devFlag} ${packages}`.trim();
        case "pnpm":
            return `pnpm add ${devFlag} ${packages}`.trim();
        case "bun":
            return `bun add ${devFlag} ${packages}`.trim();
    }
};

export const getRunCommand = (pm: PackageManager): string => {
    switch (pm) {
        case "npm":
            return "npm run dev";
        case "yarn":
            return "yarn dev";
        case "pnpm":
            return "pnpm dev";
        case "bun":
            return "bun dev";
    }
};

export const isValidProjectName = (name: string): boolean => {
    return /^[a-z0-9-]+$/.test(name);
};

export const isValidAppId = (appId: string): boolean => {
    return /^[a-zA-Z][a-zA-Z0-9]*(\.[a-zA-Z][a-zA-Z0-9]*)+$/.test(appId);
};

const runCommand = (command: string, cwd: string): Promise<void> => {
    return new Promise((resolve, reject) => {
        const proc = spawn(command, { cwd, stdio: "pipe", shell: true });
        proc.on("close", (code) =>
            code === 0 ? resolve() : reject(new Error(`Command failed with exit code ${code}`)),
        );
        proc.on("error", reject);
    });
};

const suggestAppId = (name: string): string => {
    const sanitized = name.replace(/-/g, "");
    return `org.gtkx.${sanitized}`;
};

export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    p.intro("Create GTKX App");

    const name =
        options.name ??
        ((await p.text({
            message: "Project name",
            placeholder: "my-app",
            validate: (value) => {
                if (!value) return "Project name is required";
                if (!isValidProjectName(value)) {
                    return "Project name must be lowercase letters, numbers, and hyphens only";
                }
                if (existsSync(resolve(process.cwd(), value))) {
                    return `Directory "${value}" already exists`;
                }
                return undefined;
            },
        })) as string);

    if (p.isCancel(name)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const defaultAppId = suggestAppId(name);
    const appId =
        options.appId ??
        ((await p.text({
            message: "App ID",
            placeholder: defaultAppId,
            initialValue: defaultAppId,
            validate: (value) => {
                if (!value) return "App ID is required";
                if (!isValidAppId(value)) {
                    return "App ID must be reverse domain notation (e.g., com.example.myapp)";
                }
                return undefined;
            },
        })) as string);

    if (p.isCancel(appId)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const packageManager =
        options.packageManager ??
        ((await p.select({
            message: "Package manager",
            options: [
                { value: "pnpm", label: "pnpm", hint: "recommended" },
                { value: "npm", label: "npm" },
                { value: "yarn", label: "yarn" },
                { value: "bun", label: "bun" },
            ],
            initialValue: "pnpm",
        })) as PackageManager);

    if (p.isCancel(packageManager)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const testing =
        options.testing ??
        ((await p.select({
            message: "Testing framework",
            options: [
                { value: "vitest", label: "Vitest", hint: "recommended" },
                { value: "jest", label: "Jest" },
                { value: "node", label: "Node.js Test Runner" },
                { value: "none", label: "None" },
            ],
            initialValue: "vitest",
        })) as TestingFramework);

    if (p.isCancel(testing)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }

    const projectPath = resolve(process.cwd(), name);

    const s = p.spinner();
    s.start("Creating project structure...");

    mkdirSync(projectPath, { recursive: true });
    mkdirSync(join(projectPath, "src"), { recursive: true });

    if (testing !== "none") {
        mkdirSync(join(projectPath, "tests"), { recursive: true });
    }

    writeFileSync(join(projectPath, "package.json"), generatePackageJson(name, appId, testing));
    writeFileSync(join(projectPath, "tsconfig.json"), generateTsConfig());
    writeFileSync(join(projectPath, "src", "app.tsx"), generateAppTsx(name, appId));
    writeFileSync(join(projectPath, "src", "index.tsx"), generateIndexTsx());
    writeFileSync(join(projectPath, ".gitignore"), generateGitignore());

    if (testing === "vitest") {
        writeFileSync(join(projectPath, "vitest.config.ts"), generateVitestConfig());
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), generateExampleTest(testing));
    } else if (testing === "jest") {
        writeFileSync(join(projectPath, "jest.config.js"), generateJestConfig());
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), generateExampleTest(testing));
    } else if (testing === "node") {
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), generateExampleTest(testing));
    }

    s.stop("Project structure created!");

    const installSpinner = p.spinner();
    installSpinner.start("Installing dependencies...");

    const devDeps = [...DEV_DEPENDENCIES];
    if (testing !== "none") {
        devDeps.push(...TESTING_DEV_DEPENDENCIES[testing]);
        if (testing === "node") {
            devDeps.push("tsx");
        }
    }

    try {
        const addCmd = getAddCommand(packageManager, DEPENDENCIES, false);
        await runCommand(addCmd, projectPath);

        const addDevCmd = getAddCommand(packageManager, devDeps, true);
        await runCommand(addDevCmd, projectPath);

        installSpinner.stop("Dependencies installed!");
    } catch (error) {
        installSpinner.stop("Failed to install dependencies");
        p.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        p.log.info("You can install dependencies manually by running:");
        p.log.info(`  cd ${name}`);
        p.log.info(`  ${getAddCommand(packageManager, DEPENDENCIES, false)}`);
        p.log.info(`  ${getAddCommand(packageManager, devDeps, true)}`);
    }

    const runCmd = getRunCommand(packageManager);

    const nextSteps = `cd ${name}
${runCmd}`;

    const testingNote =
        testing !== "none"
            ? `

To run tests, you need xvfb installed:
  Fedora: sudo dnf install xorg-x11-server-Xvfb
  Ubuntu: sudo apt install xvfb`
            : "";

    p.note(`${nextSteps}${testingNote}`, "Next steps");
};
