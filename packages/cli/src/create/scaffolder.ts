import { join, resolve } from "node:path";
import { isValidAppId } from "../config.js";
import type { TemplateContext } from "../templates.js";
import { isValidProjectName, type TestingOption } from "./options.js";

/**
 * Supported package managers for GTKX projects.
 */
export type PackageManager = "pnpm" | "npm" | "yarn";

/**
 * Options accepted by {@link Scaffolder.run}. Missing fields are filled
 * interactively via the injected prompt collaborator.
 */
export type CreateOptions = {
    name?: string;
    appId?: string;
    packageManager?: PackageManager;
    testing?: TestingOption;
    claudeSkills?: boolean;
};

/**
 * Resolved options after all prompts have been answered.
 */
export type ResolvedOptions = {
    name: string;
    appId: string;
    packageManager: PackageManager;
    testing: TestingOption;
    claudeSkills: boolean;
};

/**
 * Minimal `@clack/prompts` surface area the scaffolder relies on, expressed
 * as a `Pick` of the real package so tests inject a structurally compatible
 * mock without re-deriving clack's option shapes.
 */
export type ScaffolderPrompts = Pick<
    typeof import("@clack/prompts"),
    "intro" | "note" | "cancel" | "text" | "select" | "confirm" | "isCancel"
> & {
    spinner(): { start(msg: string): void; stop(msg: string): void };
    log: { info(msg: string): void; error(msg: string): void };
};

/**
 * Filesystem operations the scaffolder needs.
 */
export type ScaffolderFs = {
    existsSync(path: string): boolean;
    mkdirSync(path: string, opts: { recursive: boolean }): void;
    writeFileSync(path: string, content: string): void;
};

/**
 * Function invoked to install a set of dependencies into a freshly scaffolded
 * project. Production wires this to `nypm`.
 */
export type InstallDependenciesFn = (opts: {
    cwd: string;
    packageManager: PackageManager;
    dependencies: string[];
    dev: boolean;
}) => Promise<void>;

/**
 * Function invoked to initialize a git repository at the given directory.
 * Production wires this to `tinyexec`.
 */
export type GitInitFn = (cwd: string) => Promise<void>;

/**
 * Collaborators required by {@link createScaffolder}.
 */
export type ScaffolderDeps = {
    cwd(): string;
    fs: ScaffolderFs;
    prompts: ScaffolderPrompts;
    render(template: string, context: TemplateContext): string;
    install: InstallDependenciesFn;
    gitInit: GitInitFn;
    detectPackageManager(cwd: string): Promise<PackageManager | undefined>;
    exit(code: number): never;
};

/**
 * Public surface of the configured scaffolder.
 */
export type Scaffolder = {
    /**
     * Runs the full scaffold flow: prompts → file writes → install → git.
     */
    run(options?: CreateOptions): Promise<void>;
};

const DEPENDENCIES = ["@gtkx/css", "@gtkx/ffi", "@gtkx/react", "react"];

const DEV_DEPENDENCIES = ["@gtkx/cli", "@types/react", "typescript", "vite"];

const TESTING_DEV_DEPENDENCIES = ["@gtkx/testing", "@gtkx/vitest", "vitest"];

const RUN_DEV_COMMAND: Record<PackageManager, string> = {
    pnpm: "pnpm dev",
    npm: "npm run dev",
    yarn: "yarn dev",
};

/**
 * Returns the conventional "run the dev server" command line for a given
 * package manager.
 *
 * @param pm - The package manager.
 * @returns The shell command to print in the "next steps" hint.
 */
export const getRunCommand = (pm: PackageManager): string => RUN_DEV_COMMAND[pm];

const titleFromName = (name: string): string =>
    name
        .split("-")
        .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
        .join(" ");

const suggestAppId = (name: string): string => `com.${name.replaceAll("-", "")}.app`;

const getDevDependencies = (testing: TestingOption): string[] => {
    const devDeps = [...DEV_DEPENDENCIES];
    if (testing === "vitest") {
        devDeps.push(...TESTING_DEV_DEPENDENCIES);
    }
    return devDeps;
};

const guardCancellation = <T>(deps: ScaffolderDeps, value: T | symbol): T => {
    if (deps.prompts.isCancel(value)) {
        deps.prompts.cancel("Operation canceled");
        deps.exit(0);
    }
    return value as T;
};

const validateProjectName = (deps: ScaffolderDeps, value: string | undefined): string | undefined => {
    if (!value) return "Project name is required";
    if (!isValidProjectName(value)) {
        return "Project name must be lowercase letters, numbers, and hyphens only";
    }
    if (deps.fs.existsSync(resolve(deps.cwd(), value))) {
        return `Directory "${value}" already exists`;
    }
    return undefined;
};

const validateAppIdInput = (value: string | undefined): string | undefined => {
    if (!value) return "App ID is required";
    if (!isValidAppId(value)) {
        return "App ID must be reverse domain notation (e.g., com.example.myapp)";
    }
    return undefined;
};

const promptName = async (deps: ScaffolderDeps): Promise<string> =>
    guardCancellation(
        deps,
        await deps.prompts.text({
            message: "Project name",
            placeholder: "my-app",
            validate: (value) => validateProjectName(deps, value),
        }),
    );

const promptAppId = async (deps: ScaffolderDeps, name: string): Promise<string> => {
    const defaultAppId = suggestAppId(name);
    return guardCancellation(
        deps,
        await deps.prompts.text({
            message: "App ID",
            placeholder: defaultAppId,
            initialValue: defaultAppId,
            validate: validateAppIdInput,
        }),
    );
};

const promptPackageManager = async (deps: ScaffolderDeps): Promise<PackageManager> => {
    const detected = await deps.detectPackageManager(deps.cwd()).catch(() => undefined);
    const initial: PackageManager = detected ?? "pnpm";
    return guardCancellation(
        deps,
        await deps.prompts.select<PackageManager>({
            message: "Package manager",
            options: [
                { value: "pnpm", label: "pnpm", hint: detected === "pnpm" ? "detected" : "recommended" },
                { value: "npm", label: "npm", hint: detected === "npm" ? "detected" : undefined },
                { value: "yarn", label: "yarn", hint: detected === "yarn" ? "detected" : undefined },
            ],
            initialValue: initial,
        }),
    );
};

const promptTesting = async (deps: ScaffolderDeps): Promise<TestingOption> => {
    const enable = guardCancellation(
        deps,
        await deps.prompts.confirm({
            message: "Include testing setup (Vitest)?",
            initialValue: true,
        }),
    );
    return enable ? "vitest" : "none";
};

const promptClaudeSkills = async (deps: ScaffolderDeps): Promise<boolean> =>
    guardCancellation(
        deps,
        await deps.prompts.confirm({
            message: "Include Claude Code skills?",
            initialValue: true,
        }),
    );

const promptForOptions = async (deps: ScaffolderDeps, options: CreateOptions): Promise<ResolvedOptions> => {
    const name = options.name ?? (await promptName(deps));
    const appId = options.appId ?? (await promptAppId(deps, name));
    const packageManager = options.packageManager ?? (await promptPackageManager(deps));
    const testing = options.testing ?? (await promptTesting(deps));
    const claudeSkills = options.claudeSkills ?? (await promptClaudeSkills(deps));
    return { name, appId, packageManager, testing, claudeSkills };
};

const writeClaudeSkills = (deps: ScaffolderDeps, projectPath: string, context: TemplateContext): void => {
    const skillsDir = join(projectPath, ".claude", "skills", "developing-gtkx-apps");
    deps.fs.mkdirSync(skillsDir, { recursive: true });
    deps.fs.writeFileSync(join(skillsDir, "SKILL.md"), deps.render("claude/SKILL.md.ejs", context));
    deps.fs.writeFileSync(join(skillsDir, "WIDGETS.md"), deps.render("claude/WIDGETS.md.ejs", context));
    deps.fs.writeFileSync(join(skillsDir, "EXAMPLES.md"), deps.render("claude/EXAMPLES.md.ejs", context));
};

const writeVitestFiles = (deps: ScaffolderDeps, projectPath: string, context: TemplateContext): void => {
    deps.fs.writeFileSync(join(projectPath, "vitest.config.ts"), deps.render("config/vitest.config.ts.ejs", context));
    deps.fs.writeFileSync(join(projectPath, "tests", "app.test.tsx"), deps.render("tests/app.test.tsx.ejs", context));
};

const scaffoldProject = (deps: ScaffolderDeps, projectPath: string, resolved: ResolvedOptions): void => {
    const { name, appId, testing, claudeSkills } = resolved;
    const context: TemplateContext = { name, appId, title: titleFromName(name), testing };

    deps.fs.mkdirSync(projectPath, { recursive: true });
    deps.fs.mkdirSync(join(projectPath, "src"), { recursive: true });
    if (testing !== "none") {
        deps.fs.mkdirSync(join(projectPath, "tests"), { recursive: true });
    }

    deps.fs.writeFileSync(join(projectPath, "package.json"), deps.render("package.json.ejs", context));
    deps.fs.writeFileSync(join(projectPath, "gtkx.config.ts"), deps.render("gtkx.config.ts.ejs", context));
    deps.fs.writeFileSync(join(projectPath, "tsconfig.json"), deps.render("tsconfig.json.ejs", context));
    deps.fs.writeFileSync(join(projectPath, "src", "app.tsx"), deps.render("src/app.tsx.ejs", context));
    deps.fs.writeFileSync(join(projectPath, "src", "index.tsx"), deps.render("src/index.tsx.ejs", context));
    deps.fs.writeFileSync(join(projectPath, "src", "gtkx-env.d.ts"), deps.render("src/gtkx-env.d.ts.ejs", context));
    deps.fs.writeFileSync(join(projectPath, ".gitignore"), deps.render("gitignore.ejs", context));

    if (claudeSkills) writeClaudeSkills(deps, projectPath, context);
    if (testing === "vitest") writeVitestFiles(deps, projectPath, context);
};

type InstallAllOptions = {
    projectPath: string;
    name: string;
    packageManager: PackageManager;
    devDependencies: string[];
};

const installAllDependencies = async (deps: ScaffolderDeps, options: InstallAllOptions): Promise<void> => {
    const { projectPath, name, packageManager, devDependencies } = options;
    const spinner = deps.prompts.spinner();
    spinner.start("Installing dependencies...");

    try {
        await deps.install({ cwd: projectPath, packageManager, dependencies: DEPENDENCIES, dev: false });
        await deps.install({ cwd: projectPath, packageManager, dependencies: devDependencies, dev: true });
        spinner.stop("Dependencies installed!");
    } catch (error) {
        spinner.stop("Failed to install dependencies");
        deps.prompts.log.error(`Error: ${error instanceof Error ? error.message : String(error)}`);
        deps.prompts.log.info("You can install dependencies manually by running:");
        deps.prompts.log.info(`  cd ${name}`);
    }
};

const initializeGitRepo = async (deps: ScaffolderDeps, projectPath: string): Promise<void> => {
    const spinner = deps.prompts.spinner();
    spinner.start("Initializing git repository...");
    try {
        await deps.gitInit(projectPath);
        spinner.stop("Git repository initialized!");
    } catch {
        spinner.stop("Failed to initialize git repository");
    }
};

const XVFB_NOTE = `

To run tests, you need xvfb installed:
  Fedora: sudo dnf install xorg-x11-server-Xvfb
  Ubuntu: sudo apt install xvfb`;

const printNextSteps = (deps: ScaffolderDeps, resolved: ResolvedOptions): void => {
    const runCmd = getRunCommand(resolved.packageManager);
    const nextSteps = `cd ${resolved.name}\n${runCmd}`;
    const testingNote = resolved.testing === "none" ? "" : XVFB_NOTE;
    deps.prompts.note(`${nextSteps}${testingNote}`, "Next steps");
};

/**
 * Builds the configured scaffolder closure.
 *
 * @param deps - Collaborators that provide every side-effecting capability
 *   the scaffolder needs.
 * @returns A {@link Scaffolder} instance whose `run` performs the scaffold.
 */
export const createScaffolder = (deps: ScaffolderDeps): Scaffolder => ({
    async run(options: CreateOptions = {}): Promise<void> {
        deps.prompts.intro("Create GTKX App");

        const resolved = await promptForOptions(deps, options);
        const projectPath = resolve(deps.cwd(), resolved.name);
        const devDeps = getDevDependencies(resolved.testing);

        const projectSpinner = deps.prompts.spinner();
        projectSpinner.start("Creating project structure...");
        scaffoldProject(deps, projectPath, resolved);
        projectSpinner.stop("Project structure created!");

        await installAllDependencies(deps, {
            projectPath,
            name: resolved.name,
            packageManager: resolved.packageManager,
            devDependencies: devDeps,
        });
        await initializeGitRepo(deps, projectPath);

        printNextSteps(deps, resolved);
    },
});
