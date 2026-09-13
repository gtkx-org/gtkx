import * as p from "@clack/prompts";
import { APPLICATION_ID_MAX_LENGTH, isValidApplicationId } from "@gtkx/config/internal";
import { errorMessage, tryResolveExecutable, upperFirst } from "@gtkx/utils";
import { execFileSync } from "node:child_process";
import { lstatSync, mkdirSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, join, relative, resolve, sep } from "node:path";
import { addDependency, detectPackageManager as nypmDetectPackageManager } from "nypm";
import { x } from "tinyexec";
import packageManifest from "../package.json" with { type: "json" };
import { writeBuildAllowance } from "./build-allowance.js";
import { OperationCanceledError, ScaffoldAbortedError } from "./errors.js";
import { updateManifest } from "./manifest.js";
import {
    isKnownPackageManager,
    PACKAGE_MANAGER_VALUES,
    PACKAGE_MANAGERS,
    type PackageManager,
} from "./package-managers.js";
import { isValidProjectName } from "./project-name.js";
import { listTemplates, renderFile, type TemplateContext } from "./templates.js";

type CreateOptions = {
    name?: string | undefined;
    applicationId?: string | undefined;
    displayName?: string | undefined;
    packageManager?: string | undefined;
    isTypescript?: boolean | undefined;
    shouldIncludeTesting?: boolean | undefined;
    isInteractive?: boolean | undefined;
    shouldOverwrite?: boolean | undefined;
    shouldInstallDependencies?: boolean | undefined;
};

type ResolvedOptions = {
    target: string;
    root: string;
    name: string;
    displayName: string;
    applicationId: string;
    packageManager: PackageManager;
    isTypescript: boolean;
    shouldIncludeTesting: boolean;
    shouldInitializeGit: boolean;
    shouldInstallDependencies: boolean;
};

type ScaffoldFile = { destination: string; contents: string };

type ScaffoldChanges = string[];

type ScaffoldPlan = {
    files: ScaffoldFile[];
    replaceDestinations: string[];
    changes: ScaffoldChanges;
};

type SpinnerStep = {
    pending: string;
    done: string;
    failed: string;
    run: () => Promise<void> | void;
    explain?: (() => void) | undefined;
};

const selfVersion = packageManifest.version;
const ICON_TEMPLATE_NAME = "icon.svg";
const TYPESCRIPT_VERSION = "^6.0.3";

const DEPENDENCIES = ["@gtkx/cairo", "@gtkx/css", "@gtkx/runtime", "@gtkx/react", "react"];
const DEV_DEPENDENCIES = ["@gtkx/cli", "@gtkx/config", "@gtkx/mcp", "vite"];
const TYPESCRIPT_DEV_DEPENDENCIES = ["@types/node", "@types/react", "typescript"];
const TESTING_DEV_DEPENDENCIES = ["@gtkx/testing", "vitest"];

const DEV_COMMAND: Record<PackageManager, string> = Object.fromEntries(
    PACKAGE_MANAGERS.map((manager) => [manager.value, manager.devCommand]),
) as Record<PackageManager, string>;

const INSTALL_COMMAND: Record<PackageManager, string> = Object.fromEntries(
    PACKAGE_MANAGERS.map((manager) => [manager.value, manager.installCommand]),
) as Record<PackageManager, string>;

const INHERITED_SCRIPT_POLICY_VARS = ["npm_config_allow_scripts", "npm_config_allow-scripts"];
const TESTING_TEMPLATES = new Set(["vitest.config.ts", "tests/app.test.tsx"]);
const TYPESCRIPT_TEMPLATES = new Set(["tsconfig.json", "src/gtkx-env.d.ts"]);

const HEADLESS_COMPOSITOR_NOTE = `

To run tests, you need a headless Wayland compositor installed:
  Fedora: sudo dnf install sway
  Ubuntu: sudo apt install sway`;

const APPLICATION_ID_FORMAT_ERROR = "Application ID must be reverse domain notation (e.g., com.example.myapp)";
const APPLICATION_ID_PREFIX = "com.";
const APPLICATION_ID_SUFFIX = ".app";

const APPLICATION_ID_SEGMENT_LIMIT = APPLICATION_ID_MAX_LENGTH - APPLICATION_ID_PREFIX.length -
    APPLICATION_ID_SUFFIX.length;

const displayNameFromProjectName = (name: string): string =>
    name.split("-").map((part) => upperFirst(part)).join(" ");

const gitConfigValue = (key: string): string | null => {
    const git = tryResolveExecutable("git");

    if (git === undefined) {
        return null;
    }

    try {
        return execFileSync(git, ["config", "--get", key], { encoding: "utf8" }).trim() || null;
    } catch {
        return null;
    }
};

const applicationIdSegment = (name: string): string => {
    const compact = name.replaceAll("-", "");
    const segment = /^[A-Za-z_]/.test(compact) ? compact : `_${compact}`;

    return segment.slice(0, APPLICATION_ID_SEGMENT_LIMIT);
};

const suggestApplicationId = (name: string): string =>
    `${APPLICATION_ID_PREFIX}${applicationIdSegment(name)}${APPLICATION_ID_SUFFIX}`;

const deriveProjectName = (target: string): string => basename(resolve(process.cwd(), target));

const isDirEmpty = (dir: string): boolean => {
    const entries = readdirSync(dir);

    return entries.length === 0 || (entries.length === 1 && entries[0] === ".git");
};

const shouldInitializeGit = (root: string): boolean => {
    const entry = lstatSync(root, { throwIfNoEntry: false });

    return entry === undefined || (entry.isDirectory() && readdirSync(root).length === 0);
};

const getDevDependencies = ({
    isTypescript,
    shouldIncludeTesting,
}: Pick<ResolvedOptions, "isTypescript" | "shouldIncludeTesting">): string[] => {
    const devDeps = [...DEV_DEPENDENCIES];

    if (isTypescript) {
        devDeps.push(...TYPESCRIPT_DEV_DEPENDENCIES);
    }

    if (shouldIncludeTesting) {
        devDeps.push(...TESTING_DEV_DEPENDENCIES);
    }

    return devDeps;
};

const isCancellation = (value: unknown): value is typeof p.CANCEL_SYMBOL => p.isCancel(value);

const guardCancellation = <T>(value: T | typeof p.CANCEL_SYMBOL): T => {
    if (isCancellation(value)) {
        p.cancel("Operation canceled");
        throw new OperationCanceledError();
    }

    return value;
};

const validateProjectName = (value: string | undefined): string | undefined => {
    if (!value) {
        return "Project name is required";
    }

    if (!isValidProjectName(value)) {
        return "Project name must be lowercase letters, numbers, and hyphens only";
    }

    return undefined;
};

const validateApplicationIdFormat = (value: string): string | undefined =>
    isValidApplicationId(value) ? undefined : APPLICATION_ID_FORMAT_ERROR;

const validateApplicationIdInput = (value: string | undefined): string | undefined =>
    value ? validateApplicationIdFormat(value) : "Application ID is required";

const validateApplicationIdAnswer = (value: string | undefined): string | undefined =>
    value ? validateApplicationIdFormat(value) : undefined;

const validateDisplayName = (value: string | undefined): string | undefined => {
    if (value === undefined || value.trim().length === 0) {
        return "Display name is required";
    }

    return value.includes("\n") || value.includes("\r") ? "Display name must be a single line" : undefined;
};

const validateDisplayNameAnswer = (value: string | undefined): string | undefined =>
    value ? validateDisplayName(value) : undefined;

const fail = (message: string): never => {
    p.log.error(message);
    throw new ScaffoldAbortedError(message);
};

const requestedPackageManager = (value: string | undefined): PackageManager | undefined => {
    if (value === undefined) {
        return undefined;
    }

    if (!isKnownPackageManager(value)) {
        return fail(`Unknown package manager "${value}". Expected one of: ${PACKAGE_MANAGER_VALUES.join(", ")}`);
    }

    return value;
};

const validateTargetDir = (target: string): string | undefined => {
    if (!target) {
        return "Project directory is required";
    }

    return validateProjectName(deriveProjectName(target));
};

const validateTargetAnswer = (value: string | undefined): string | undefined =>
    validateTargetDir(value ?? "");

const promptTarget = async (): Promise<string> =>
    guardCancellation(
        await p.text({
            message: "Project directory",
            placeholder: "my-app",
            validate: validateTargetAnswer,
        }),
    );

const promptApplicationId = async (name: string): Promise<string> => {
    const defaultApplicationId = suggestApplicationId(name);

    return guardCancellation(
        await p.text({
            message: "Application ID",
            placeholder: defaultApplicationId,
            defaultValue: defaultApplicationId,
            validate: validateApplicationIdAnswer,
        }),
    );
};

const promptDisplayName = async (name: string): Promise<string> => {
    const defaultDisplayName = displayNameFromProjectName(name);

    return guardCancellation(
        await p.text({
            message: "Display name",
            placeholder: defaultDisplayName,
            defaultValue: defaultDisplayName,
            validate: validateDisplayNameAnswer,
        }),
    );
};

const packageManagerOption = (manager: (typeof PACKAGE_MANAGERS)[number], detected: PackageManager | undefined) => {
    let hint: string | undefined;

    if (detected === manager.value) {
        hint = "detected";
    } else if (manager.isRecommended) {
        hint = "recommended";
    }

    return { value: manager.value, label: manager.label, ...(hint !== undefined && { hint }) };
};

const detectedPackageManager = async (): Promise<PackageManager | undefined> => {
    try {
        const detected = await nypmDetectPackageManager(process.cwd(), { includeParentDirs: true });

        return detected && isKnownPackageManager(detected.name) ? detected.name : undefined;
    } catch {
        return undefined;
    }
};

const promptPackageManager = async (): Promise<PackageManager> => {
    const detected = await detectedPackageManager();
    const initial: PackageManager = detected ?? "pnpm";

    return guardCancellation(
        await p.select<PackageManager>({
            message: "Package manager",
            options: PACKAGE_MANAGERS.map((manager) => packageManagerOption(manager, detected)),
            initialValue: initial,
        }),
    );
};

const isOptionEnabled = async (
    value: boolean | undefined,
    isInteractive: boolean | undefined,
    message: string,
): Promise<boolean> =>
    value ?? (!isInteractive || guardCancellation(await p.confirm({ message, initialValue: true })));

const formatFileList = (heading: string, files: string[]): string => {
    const indentedFiles = files.map((file) => `  ${file}`).join("\n");

    return `${heading}:\n${indentedFiles}`;
};

const reportPlannedChanges = (changes: ScaffoldChanges): void => {
    if (changes.length > 0) {
        p.log.info(formatFileList("Scaffold files to replace", changes));
    }
};

const reportCompletedChanges = (changes: ScaffoldChanges): void => {
    if (changes.length > 0) {
        p.log.success(formatFileList("Replaced scaffold files", changes));
    }
};

const confirmOverwrite = async (target: string, changes: ScaffoldChanges): Promise<void> => {
    reportPlannedChanges(changes);

    const shouldReplace = guardCancellation(
        await p.confirm({
            message: `Directory "${target}" is not empty. Replace scaffold files?`,
            initialValue: false,
        }),
    );

    if (!shouldReplace) {
        fail(`Directory "${target}" is not empty`);
    }
};

const refuseNonEmptyDirectory = (target: string, changes: ScaffoldChanges): never => {
    const heading = `Directory "${target}" is not empty. Pass --overwrite to`;

    return fail(
        changes.length === 0
            ? `${heading} scaffold into it`
            : formatFileList(`${heading} replace these scaffold files`, changes),
    );
};

const acceptNonEmptyDirectory = async (
    target: string,
    options: CreateOptions,
    changes: ScaffoldChanges,
): Promise<void> => {
    if (options.isInteractive) {
        await confirmOverwrite(target, changes);

        return;
    }

    if (options.shouldOverwrite === true) {
        reportPlannedChanges(changes);

        return;
    }

    refuseNonEmptyDirectory(target, changes);
};

const assertTargetIsDirectory = (root: string, target: string): void => {
    const stats = lstatSync(root, { throwIfNoEntry: false });

    if (stats?.isSymbolicLink()) {
        fail(`Cannot scaffold through a symbolic link: ${root}`);
    }

    if (stats !== undefined && !stats.isDirectory()) {
        fail(`Target "${target}" is not a directory`);
    }
};

const validateTargetAvailability = async (
    root: string,
    target: string,
    options: CreateOptions,
    changes: ScaffoldChanges,
): Promise<void> => {
    const stats = statSync(root, { throwIfNoEntry: false });

    if (stats === undefined || isDirEmpty(root)) {
        return;
    }

    await acceptNonEmptyDirectory(target, options, changes);
};

const resolveTarget = async (options: CreateOptions): Promise<string> => {
    if (options.name === undefined && options.isInteractive) {
        return promptTarget();
    }

    const target = options.name ?? "";
    const error = validateTargetDir(target);

    return error === undefined ? target : fail(error);
};

const resolveApplicationId = async (options: CreateOptions, name: string): Promise<string> => {
    const applicationId = options.applicationId ??
        (options.isInteractive ? await promptApplicationId(name) : suggestApplicationId(name));

    const error = validateApplicationIdInput(applicationId);

    return error === undefined ? applicationId : fail(error);
};

const resolveDisplayName = async (options: CreateOptions, name: string): Promise<string> => {
    const value = options.displayName ??
        (options.isInteractive ? await promptDisplayName(name) : displayNameFromProjectName(name));
    const error = validateDisplayName(value);

    return error === undefined ? value.trim() : fail(error);
};

const resolvePackageManager = async (
    requested: PackageManager | undefined,
    options: CreateOptions,
): Promise<PackageManager> => {
    if (requested !== undefined) {
        return requested;
    }

    if (options.isInteractive) {
        return promptPackageManager();
    }

    return (await detectedPackageManager()) ?? "pnpm";
};

const resolveOptions = async (options: CreateOptions): Promise<ResolvedOptions> => {
    const requested = requestedPackageManager(options.packageManager);
    const target = await resolveTarget(options);
    const name = deriveProjectName(target);
    const displayName = await resolveDisplayName(options, name);
    const applicationId = await resolveApplicationId(options, name);
    const root = resolve(process.cwd(), target);
    const shouldInitialize = shouldInitializeGit(root);
    const packageManager = await resolvePackageManager(requested, options);
    const isTypescript = await isOptionEnabled(options.isTypescript, options.isInteractive, "Use TypeScript?");

    const shouldIncludeTesting = await isOptionEnabled(
        options.shouldIncludeTesting,
        options.isInteractive,
        "Include testing setup (Vitest)?",
    );

    return {
        target,
        root,
        name,
        displayName,
        applicationId,
        packageManager,
        isTypescript,
        shouldIncludeTesting,
        shouldInitializeGit: shouldInitialize,
        shouldInstallDependencies: options.shouldInstallDependencies !== false,
    };
};

const isTemplateIncluded = (templateRelativePath: string, resolved: ResolvedOptions): boolean => {
    if (TESTING_TEMPLATES.has(templateRelativePath)) {
        return resolved.shouldIncludeTesting;
    }

    if (TYPESCRIPT_TEMPLATES.has(templateRelativePath)) {
        return resolved.isTypescript;
    }

    return true;
};

const destinationPath = (template: string, resolved: ResolvedOptions): string => {
    const scriptPath = resolved.isTypescript ? template : template.replace(/\.tsx$/, ".jsx").replace(/\.ts$/, ".js");

    return scriptPath.endsWith(ICON_TEMPLATE_NAME)
        ? `${scriptPath.slice(0, -ICON_TEMPLATE_NAME.length)}${resolved.applicationId}.svg`
        : scriptPath;
};

const templateContext = (resolved: ResolvedOptions): TemplateContext => ({
    name: resolved.name,
    applicationId: resolved.applicationId,
    displayName: resolved.displayName,
    shouldIncludeTesting: resolved.shouldIncludeTesting,
    isTypescript: resolved.isTypescript,
    importExtension: resolved.isTypescript ? ".js" : ".jsx",
    developerName: gitConfigValue("user.name") ?? resolved.displayName,
    developerEmail: gitConfigValue("user.email"),
});

const assertSafeAncestor = (ancestor: string): void => {
    const entry = lstatSync(ancestor, { throwIfNoEntry: false });

    if (entry?.isSymbolicLink()) {
        fail(`Cannot scaffold through a symbolic link: ${ancestor}`);
    }

    if (entry !== undefined && !entry.isDirectory()) {
        fail(`Cannot scaffold through a non-directory path: ${ancestor}`);
    }
};

const assertSafeAncestors = (root: string, relativePath: string): void => {
    let ancestor = root;
    const segments = relativePath.split(sep);
    const ancestorSegments = segments.slice(0, -1);

    for (const segment of ancestorSegments) {
        ancestor = join(ancestor, segment);
        assertSafeAncestor(ancestor);
    }
};

const hasReplaceableDestination = (destination: string): boolean => {
    const entry = lstatSync(destination, { throwIfNoEntry: false });
    const isReplaceable = entry === undefined || entry.isFile() || entry.isSymbolicLink();

    if (!isReplaceable) {
        fail(`Cannot replace scaffold file because its destination is not a file: ${destination}`);
    }

    return entry !== undefined;
};

const hasExistingDestination = (root: string, destination: string): boolean => {
    assertSafeAncestors(root, relative(root, destination));

    return hasReplaceableDestination(destination);
};

const plannedScaffoldFiles = async (root: string, resolved: ResolvedOptions): Promise<ScaffoldFile[]> => {
    const context = templateContext(resolved);
    const files: ScaffoldFile[] = [];

    for (const template of listTemplates()) {
        if (isTemplateIncluded(template, resolved)) {
            files.push({
                destination: join(root, destinationPath(template, resolved)),
                contents: await renderFile(template, context),
            });
        }
    }

    return files;
};

const auxiliaryDestinations = (root: string, resolved: ResolvedOptions): string[] =>
    resolved.packageManager === "pnpm" ? [join(root, "pnpm-workspace.yaml")] : [];

const planScaffoldProject = async (root: string, resolved: ResolvedOptions): Promise<ScaffoldPlan> => {
    const files = await plannedScaffoldFiles(root, resolved);
    const destinations = [...files.map((file) => file.destination), ...auxiliaryDestinations(root, resolved)];
    const replaceDestinations = destinations.filter((destination) => hasExistingDestination(root, destination));

    return {
        files,
        replaceDestinations,
        changes: replaceDestinations.map((destination) => relative(root, destination)),
    };
};

const scaffoldProject = (plan: ScaffoldPlan): void => {
    for (const destination of plan.replaceDestinations) {
        rmSync(destination);
    }

    for (const file of plan.files) {
        mkdirSync(dirname(file.destination), { recursive: true });
        writeFileSync(file.destination, file.contents);
    }
};

const withoutInheritedScriptPolicy = async (run: () => Promise<void>): Promise<void> => {
    const saved = INHERITED_SCRIPT_POLICY_VARS.map((key) => [key, process.env[key]] as const);

    for (const [key] of saved) {
        Reflect.deleteProperty(process.env, key);
    }

    try {
        await run();
    } finally {
        for (const [key, value] of saved) {
            if (value !== undefined) {
                process.env[key] = value;
            }
        }
    }
};

const dependencyVersions = (names: string[]): Record<string, string> => Object.fromEntries(
    names.map((dependency) => {
        if (dependency.startsWith("@gtkx/")) {
            return [dependency, `^${selfVersion}`];
        }

        return [dependency, dependency === "typescript" ? TYPESCRIPT_VERSION : "latest"];
    }),
);

const dependencyArguments = (names: string[]): string[] =>
    Object.entries(dependencyVersions(names)).map(([name, version]) =>
        version === "latest" ? name : `${name}@${version}`);

const writeDependencies = (root: string, devDependencies: string[]): void => {
    updateManifest(root, (manifest) => {
        manifest.dependencies = dependencyVersions(DEPENDENCIES);
        manifest.devDependencies = dependencyVersions(devDependencies);
    });
};

const formatRecovery = (resolved: ResolvedOptions): string =>
    `To finish setup, run ${INSTALL_COMMAND[resolved.packageManager]} in ${resolved.root}.`;

const runWithSpinner = async (step: SpinnerStep): Promise<void> => {
    const spinner = p.spinner();
    spinner.start(step.pending);

    try {
        await step.run();
        spinner.stop(step.done);
    } catch (error) {
        spinner.error(step.failed);
        p.log.error(errorMessage(error));
        step.explain?.();
        throw new ScaffoldAbortedError(step.failed);
    }
};

const installAllDependencies = async (resolved: ResolvedOptions, devDependencies: string[]): Promise<void> => {
    const { root, packageManager } = resolved;

    await runWithSpinner({
        pending: "Installing dependencies...",
        done: "Dependencies installed",
        failed: "Failed to install dependencies",
        run: async () => {
            await withoutInheritedScriptPolicy(async () => {
                const options = { cwd: root, packageManager, silent: true };
                await addDependency(dependencyArguments(DEPENDENCIES), options);
                await addDependency(dependencyArguments(devDependencies), { ...options, dev: true });
            });
        },
        explain: () => {
            p.log.info(formatRecovery(resolved));
        },
    });
};

const isInsideGitRepository = (root: string): boolean => {
    const git = tryResolveExecutable("git");

    if (git === undefined) {
        return false;
    }

    try {
        execFileSync(git, ["-C", root, "rev-parse", "--show-toplevel"], { stdio: "ignore" });

        return true;
    } catch {
        return false;
    }
};

const initializeGitRepo = async (root: string, shouldInitialize: boolean): Promise<void> => {
    if (!shouldInitialize || isInsideGitRepository(root)) {
        return;
    }

    const spinner = p.spinner();
    spinner.start("Initializing git repository...");

    try {
        const opts = { nodeOptions: { cwd: root }, throwOnError: true } as const;
        await x("git", ["init"], opts);
        await x("git", ["add", "-A"], opts);
        await x("git", ["commit", "-m", "Initial commit"], opts);
        spinner.stop("Git repository initialized");
    } catch {
        spinner.error("Failed to initialize git repository");
    }
};

const printNextSteps = (resolved: ResolvedOptions): void => {
    const devCmd = DEV_COMMAND[resolved.packageManager];
    const installStep = resolved.shouldInstallDependencies ? "" : `${INSTALL_COMMAND[resolved.packageManager]}\n`;
    const testingNote = resolved.shouldIncludeTesting ? HEADLESS_COMPOSITOR_NOTE : "";
    p.note(`${installStep}${devCmd}${testingNote}`, `Run in ${resolved.root}`);
};

const createProjectStructure = async (
    root: string,
    resolved: ResolvedOptions,
    plan: ScaffoldPlan,
): Promise<void> => {
    await runWithSpinner({
        pending: "Creating project structure...",
        done: "Project structure created",
        failed: "Failed to create the project structure",
        run: () => {
            mkdirSync(root, { recursive: true });
            scaffoldProject(plan);
            writeBuildAllowance(root, resolved.packageManager);
        },
    });
};

const scaffold = async (options: CreateOptions = {}): Promise<void> => {
    p.intro("Create GTKX App");
    const resolved = await resolveOptions(options);
    const { root } = resolved;
    const devDeps = getDevDependencies(resolved);
    assertTargetIsDirectory(root, resolved.target);
    const plan = await planScaffoldProject(root, resolved);
    await validateTargetAvailability(root, resolved.target, options, plan.changes);
    await createProjectStructure(root, resolved, plan);
    writeDependencies(root, devDeps);
    reportCompletedChanges(plan.changes);

    if (resolved.shouldInstallDependencies) {
        await installAllDependencies(resolved, devDeps);
    }

    await initializeGitRepo(root, resolved.shouldInitializeGit);
    printNextSteps(resolved);
};

export { scaffold };
