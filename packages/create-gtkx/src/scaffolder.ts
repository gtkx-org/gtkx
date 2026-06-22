import { dirname, join, resolve } from "node:path";
import { errorMessage, isValidApplicationId, renderEmptyGtkxEnvModule, toUpperFirst } from "@gtkx/utils";
import { isValidProjectName, PACKAGE_MANAGERS, type PackageManager, type TestingOption } from "./options.js";
import { TEMPLATE_SUFFIX, type TemplateContext } from "./templates.js";

export type CreateOptions = {
    name?: string | undefined;
    applicationId?: string | undefined;
    packageManager?: PackageManager | undefined;
    testing?: TestingOption | undefined;
};

type ResolvedOptions = {
    name: string;
    applicationId: string;
    packageManager: PackageManager;
    testing: TestingOption;
};

type ScaffolderPrompts = Pick<
    typeof import("@clack/prompts"),
    "intro" | "note" | "cancel" | "text" | "select" | "confirm" | "isCancel"
> & {
    spinner(): { start(message: string): void; stop(message: string): void };
    log: { info(message: string): void; error(message: string): void };
};

type ScaffolderFs = {
    existsSync(path: string): boolean;
    mkdirSync(path: string, opts: { recursive: boolean }): void;
    writeFileSync(path: string, content: string): void;
};

type InstallDependenciesFn = (opts: {
    cwd: string;
    packageManager: PackageManager;
    dependencies: string[];
    dev: boolean;
}) => Promise<void>;

type GitInitFn = (cwd: string) => Promise<void>;

export type ScaffolderDeps = {
    cwd(): string;
    gtkxVersion: string;
    fs: ScaffolderFs;
    prompts: ScaffolderPrompts;
    listTemplates(): string[];
    render(template: string, context: TemplateContext): string;
    install: InstallDependenciesFn;
    gitInit: GitInitFn;
    detectPackageManager(cwd: string): Promise<PackageManager | undefined>;
    exit(code: number): never;
};

export type Scaffolder = {
    run(options?: CreateOptions): Promise<void>;
};

const DEPENDENCIES = ["@gtkx/css", "@gtkx/ffi", "@gtkx/react", "react"];

const DEV_DEPENDENCIES = ["@gtkx/cli", "@gtkx/config", "@types/react", "typescript", "vite"];

const pinGtkxDependency = (name: string, version: string): string =>
    name.startsWith("@gtkx/") ? `${name}@^${version}` : name;

const TESTING_DEV_DEPENDENCIES = ["@gtkx/testing", "vitest"];

const RUN_DEV_COMMAND: Record<PackageManager, string> = Object.fromEntries(
    PACKAGE_MANAGERS.map((manager) => [manager.value, manager.runDev]),
) as Record<PackageManager, string>;

const getRunCommand = (pm: PackageManager): string => RUN_DEV_COMMAND[pm];

const titleFromName = (name: string): string => name.split("-").map(toUpperFirst).join(" ");

const suggestApplicationId = (name: string): string => `com.${name.replaceAll("-", "")}.app`;

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

const validateApplicationIdInput = (value: string | undefined): string | undefined => {
    if (!value) return "Application ID is required";
    if (!isValidApplicationId(value)) {
        return "Application ID must be reverse domain notation (e.g., com.example.myapp)";
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

const promptApplicationId = async (deps: ScaffolderDeps, name: string): Promise<string> => {
    const defaultApplicationId = suggestApplicationId(name);
    return guardCancellation(
        deps,
        await deps.prompts.text({
            message: "Application ID",
            placeholder: defaultApplicationId,
            initialValue: defaultApplicationId,
            validate: validateApplicationIdInput,
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
            options: PACKAGE_MANAGERS.map((manager) => {
                const hint = detected === manager.value ? "detected" : manager.recommended ? "recommended" : undefined;
                return { value: manager.value, label: manager.label, ...(hint === undefined ? {} : { hint }) };
            }),
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

const promptForOptions = async (deps: ScaffolderDeps, options: CreateOptions): Promise<ResolvedOptions> => {
    const name = options.name ?? (await promptName(deps));
    const applicationId = options.applicationId ?? (await promptApplicationId(deps, name));
    const packageManager = options.packageManager ?? (await promptPackageManager(deps));
    const testing = options.testing ?? (await promptTesting(deps));
    return { name, applicationId, packageManager, testing };
};

const TESTING_TEMPLATE_PREFIXES = ["config/", "tests/"] as const;

const TEMPLATE_DESTINATIONS: Record<string, string> = {
    gitignore: ".gitignore",
    "config/vitest.config.ts": "vitest.config.ts",
};

const destinationFor = (templateRelativePath: string): string =>
    TEMPLATE_DESTINATIONS[templateRelativePath] ?? templateRelativePath;

const isTemplateIncluded = (templateRelativePath: string, resolved: ResolvedOptions): boolean => {
    if (TESTING_TEMPLATE_PREFIXES.some((prefix) => templateRelativePath.startsWith(prefix))) {
        return resolved.testing === "vitest";
    }
    return true;
};

const scaffoldProject = (deps: ScaffolderDeps, projectPath: string, resolved: ResolvedOptions): void => {
    const { name, applicationId, testing } = resolved;
    const context: TemplateContext = { name, applicationId, title: titleFromName(name), testing };

    deps.fs.mkdirSync(projectPath, { recursive: true });

    for (const template of deps.listTemplates()) {
        const relativeTemplate = template.slice(0, -TEMPLATE_SUFFIX.length);
        if (!isTemplateIncluded(relativeTemplate, resolved)) continue;

        const destination = join(projectPath, destinationFor(relativeTemplate));
        deps.fs.mkdirSync(dirname(destination), { recursive: true });
        deps.fs.writeFileSync(destination, deps.render(template, context));
    }
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

    const pin = (names: string[]): string[] => names.map((name) => pinGtkxDependency(name, deps.gtkxVersion));

    try {
        await deps.install({ cwd: projectPath, packageManager, dependencies: pin(DEPENDENCIES), dev: false });
        await deps.install({ cwd: projectPath, packageManager, dependencies: pin(devDependencies), dev: true });
        spinner.stop("Dependencies installed!");
    } catch (error) {
        spinner.stop("Failed to install dependencies");
        deps.prompts.log.error(`Error: ${errorMessage(error)}`);
        deps.prompts.log.info("You can install dependencies manually by running:");
        deps.prompts.log.info(`  cd ${name}`);
    }
};

const writeInitialSchemaEnv = (deps: ScaffolderDeps, projectPath: string): void => {
    const storeDir = join(projectPath, "node_modules", ".gtkx");
    deps.fs.mkdirSync(storeDir, { recursive: true });
    deps.fs.writeFileSync(join(storeDir, "env.d.ts"), renderEmptyGtkxEnvModule());
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

const HEADLESS_COMPOSITOR_NOTE = `

To run tests, you need a headless Wayland compositor installed:
  Fedora: sudo dnf install weston
  Ubuntu: sudo apt install weston`;

const printNextSteps = (deps: ScaffolderDeps, resolved: ResolvedOptions): void => {
    const runCmd = getRunCommand(resolved.packageManager);
    const nextSteps = `cd ${resolved.name}\n${runCmd}`;
    const testingNote = resolved.testing === "none" ? "" : HEADLESS_COMPOSITOR_NOTE;
    deps.prompts.note(`${nextSteps}${testingNote}`, "Next steps");
};

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
        writeInitialSchemaEnv(deps, projectPath);
        await initializeGitRepo(deps, projectPath);

        printNextSteps(deps, resolved);
    },
});
