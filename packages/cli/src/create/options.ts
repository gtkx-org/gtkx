export type TestingOption = "vitest" | "none";

const TESTING_OPTIONS: TestingOption[] = ["vitest", "none"];

export const PACKAGE_MANAGERS = [
    { value: "pnpm", label: "pnpm", runDev: "pnpm dev", recommended: true },
    { value: "npm", label: "npm", runDev: "npm run dev", recommended: false },
    { value: "yarn", label: "yarn", runDev: "yarn dev", recommended: false },
] as const;

export type PackageManager = (typeof PACKAGE_MANAGERS)[number]["value"];

export const PACKAGE_MANAGER_VALUES: PackageManager[] = PACKAGE_MANAGERS.map((manager) => manager.value);

export const isKnownPackageManager = (name: string): name is PackageManager =>
    (PACKAGE_MANAGER_VALUES as string[]).includes(name);

export const isTestingOption = (value: string): value is TestingOption => (TESTING_OPTIONS as string[]).includes(value);

export const PACKAGE_MANAGER_FLAG_DESCRIPTION = `Package manager (${PACKAGE_MANAGER_VALUES.join(", ")})`;

export const TESTING_FLAG_DESCRIPTION = `Testing setup (${TESTING_OPTIONS.join(", ")})`;

export const isValidProjectName = (name: string): boolean => /^[a-z0-9-]+$/.test(name);
