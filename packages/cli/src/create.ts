import { spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import * as p from "@clack/prompts";
import { renderFile, type TemplateContext } from "./templates.js";

/**
 * Supported package managers for GTKX projects.
 */
export type PackageManager = "pnpm" | "npm" | "yarn";

/**
 * Whether to include testing setup in GTKX projects.
 */
export type TestingOption = "vitest" | "none";

/**
 * Options for creating a new GTKX project.
 *
 * All options are optional; missing values will be prompted interactively.
 */
export type CreateOptions = {
    name?: string;
    appId?: string;
    packageManager?: PackageManager;
    testing?: TestingOption;
    claudeSkills?: boolean;
};

const DEPENDENCIES = ["@gtkx/css", "@gtkx/ffi", "@gtkx/react", "react"];

const DEV_DEPENDENCIES = ["@gtkx/cli", "@types/react", "typescript", "vite"];

const TESTING_DEV_DEPENDENCIES = ["@gtkx/testing", "@gtkx/vitest", "vitest"];

const createTemplateContext = (name: string, appId: string, testing: TestingOption): TemplateContext => {
    const title = name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

    return { name, appId, title, testing };
};

export const getAddCommand = (pm: PackageManager, deps: string[], dev: boolean): string => {
    const devFlag = dev ? (pm === "npm" ? "--save-dev" : "-D") : "";
    const parts = [devFlag, ...deps].filter(Boolean).join(" ");

    switch (pm) {
        case "npm":
            return `npm install ${parts}`;
        case "yarn":
            return `yarn add ${parts}`;
        case "pnpm":
            return `pnpm add ${parts}`;
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
    return `com.${sanitized}.app`;
};

type ResolvedOptions = {
    name: string;
    appId: string;
    packageManager: PackageManager;
    testing: TestingOption;
    claudeSkills: boolean;
};

const checkCancelled = <T>(value: T | symbol): T => {
    if (p.isCancel(value)) {
        p.cancel("Operation cancelled");
        process.exit(0);
    }
    return value as T;
};

const promptForOptions = async (options: CreateOptions): Promise<ResolvedOptions> => {
    const name =
        options.name ??
        checkCancelled(
            await p.text({
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
                },
            }),
        );

    const defaultAppId = suggestAppId(name);

    const appId =
        options.appId ??
        checkCancelled(
            await p.text({
                message: "App ID",
                placeholder: defaultAppId,
                initialValue: defaultAppId,
                validate: (value) => {
                    if (!value) return "App ID is required";
                    if (!isValidAppId(value)) {
                        return "App ID must be reverse domain notation (e.g., com.example.myapp)";
                    }
                },
            }),
        );

    const packageManager =
        options.packageManager ??
        checkCancelled(
            await p.select({
                message: "Package manager",
                options: [
                    { value: "pnpm", label: "pnpm", hint: "recommended" },
                    { value: "npm", label: "npm" },
                    { value: "yarn", label: "yarn" },
                ],
                initialValue: "pnpm",
            }),
        );

    const testing: TestingOption =
        options.testing ??
        (checkCancelled(
            await p.confirm({
                message: "Include testing setup (Vitest)?",
                initialValue: true,
            }),
        )
            ? "vitest"
            : "none");

    const claudeSkills =
        options.claudeSkills ??
        checkCancelled(
            await p.confirm({
                message: "Include Claude Code skills?",
                initialValue: true,
            }),
        );

    return { name, appId, packageManager, testing, claudeSkills };
};

const scaffoldProject = (projectPath: string, resolved: ResolvedOptions): void => {
    const { name, appId, testing, claudeSkills } = resolved;
    const context = createTemplateContext(name, appId, testing);

    mkdirSync(projectPath, { recursive: true });
    mkdirSync(join(projectPath, "src"), { recursive: true });

    if (testing !== "none") {
        mkdirSync(join(projectPath, "tests"), { recursive: true });
    }

    writeFileSync(join(projectPath, "package.json"), renderFile("package.json.ejs", context));
    writeFileSync(join(projectPath, "tsconfig.json"), renderFile("tsconfig.json.ejs", context));
    writeFileSync(join(projectPath, "src", "app.tsx"), renderFile("src/app.tsx.ejs", context));
    writeFileSync(join(projectPath, "src", "dev.tsx"), renderFile("src/dev.tsx.ejs", context));
    writeFileSync(join(projectPath, "src", "index.tsx"), renderFile("src/index.tsx.ejs", context));
    writeFileSync(join(projectPath, "src", "gtkx-env.d.ts"), renderFile("src/gtkx-env.d.ts.ejs", context));
    writeFileSync(join(projectPath, ".gitignore"), renderFile("gitignore.ejs", context));

    if (claudeSkills) {
        const skillsDir = join(projectPath, ".claude", "skills", "developing-gtkx-apps");
        mkdirSync(skillsDir, { recursive: true });
        writeFileSync(join(skillsDir, "SKILL.md"), renderFile("claude/SKILL.md.ejs", context));
        writeFileSync(join(skillsDir, "WIDGETS.md"), renderFile("claude/WIDGETS.md.ejs", context));
        writeFileSync(join(skillsDir, "EXAMPLES.md"), renderFile("claude/EXAMPLES.md.ejs", context));
    }

    if (testing === "vitest") {
        writeFileSync(join(projectPath, "vitest.config.ts"), renderFile("config/vitest.config.ts.ejs", context));
        writeFileSync(join(projectPath, "tests", "app.test.tsx"), renderFile("tests/app.test.tsx.ejs", context));
    }
};

const getDevDependencies = (testing: TestingOption): string[] => {
    const devDeps = [...DEV_DEPENDENCIES];
    if (testing === "vitest") {
        devDeps.push(...TESTING_DEV_DEPENDENCIES);
    }
    return devDeps;
};

const installDependencies = async (
    projectPath: string,
    name: string,
    packageManager: PackageManager,
    devDeps: string[],
): Promise<void> => {
    const installSpinner = p.spinner();
    installSpinner.start("Installing dependencies...");

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
};

const printNextSteps = (name: string, packageManager: PackageManager, testing: TestingOption): void => {
    const runCmd = getRunCommand(packageManager);
    const nextSteps = `cd ${name}\n${runCmd}`;

    const testingNote =
        testing !== "none"
            ? `

To run tests, you need xvfb installed:
  Fedora: sudo dnf install xorg-x11-server-Xvfb
  Ubuntu: sudo apt install xvfb`
            : "";

    p.note(`${nextSteps}${testingNote}`, "Next steps");
};

/**
 * Creates a new GTKX project with interactive prompts.
 *
 * Scaffolds a complete project structure including:
 * - TypeScript configuration
 * - React component template
 * - Development server entry point
 * - Optional testing setup
 * - Optional Claude Code skills
 *
 * @param options - Pre-filled options to skip prompts
 *
 * @example
 * ```tsx
 * import { createApp } from "@gtkx/cli";
 *
 * // Interactive mode
 * await createApp();
 *
 * // With pre-filled options
 * await createApp({
 *   name: "my-app",
 *   appId: "com.example.myapp",
 *   packageManager: "pnpm",
 *   testing: "vitest",
 * });
 * ```
 */
export const createApp = async (options: CreateOptions = {}): Promise<void> => {
    p.intro("Create GTKX App");

    const resolved = await promptForOptions(options);
    const projectPath = resolve(process.cwd(), resolved.name);

    const s = p.spinner();
    s.start("Creating project structure...");
    scaffoldProject(projectPath, resolved);
    s.stop("Project structure created!");

    const devDeps = getDevDependencies(resolved.testing);
    await installDependencies(projectPath, resolved.name, resolved.packageManager, devDeps);

    printNextSteps(resolved.name, resolved.packageManager, resolved.testing);
};
