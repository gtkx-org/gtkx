/**
 * Whether to include testing setup in GTKX projects.
 */
export type TestingOption = "vitest" | "none";

const TESTING_OPTIONS: readonly TestingOption[] = ["vitest", "none"];

/**
 * The package managers a scaffolded project supports: the run-dev command line
 * each uses and whether it is the recommended default. The single table the
 * type, the run command, the membership list, the prompt rows, and the CLI flag
 * description derive from.
 */
export const PACKAGE_MANAGERS = [
    { value: "pnpm", label: "pnpm", runDev: "pnpm dev", recommended: true },
    { value: "npm", label: "npm", runDev: "npm run dev", recommended: false },
    { value: "yarn", label: "yarn", runDev: "yarn dev", recommended: false },
] as const;

/** A package manager a scaffolded project can use, derived from {@link PACKAGE_MANAGERS}. */
export type PackageManager = (typeof PACKAGE_MANAGERS)[number]["value"];

/** The supported package-manager identifiers, for membership validation. */
export const PACKAGE_MANAGER_VALUES: readonly PackageManager[] = PACKAGE_MANAGERS.map((manager) => manager.value);

/**
 * Reports whether `name` is a supported package manager.
 *
 * @param name - The candidate package-manager identifier.
 * @returns `true` when `name` is one of {@link PACKAGE_MANAGER_VALUES}.
 */
export const isKnownPackageManager = (name: string): name is PackageManager =>
    (PACKAGE_MANAGER_VALUES as readonly string[]).includes(name);

/**
 * Reports whether `value` is a supported testing option.
 *
 * @param value - The candidate testing-setup identifier.
 * @returns `true` when `value` is `"vitest"` or `"none"`.
 */
export const isTestingOption = (value: string): value is TestingOption =>
    (TESTING_OPTIONS as readonly string[]).includes(value);

/**
 * The `--pm` flag description, derived from {@link PACKAGE_MANAGERS} so the
 * accepted values cannot drift from the supported set.
 */
export const PACKAGE_MANAGER_FLAG_DESCRIPTION = `Package manager (${PACKAGE_MANAGER_VALUES.join(", ")})`;

/**
 * The `--testing` flag description, derived from the supported testing options.
 */
export const TESTING_FLAG_DESCRIPTION = `Testing setup (${TESTING_OPTIONS.join(", ")})`;

/**
 * Validates a project directory name.
 *
 * Project names must contain only lowercase letters, numbers, and hyphens.
 *
 * @param name - Candidate project name.
 * @returns `true` when the name is valid.
 */
export const isValidProjectName = (name: string): boolean => /^[a-z0-9-]+$/.test(name);
