type PackageManager = (typeof PACKAGE_MANAGERS)[number]["value"];

const PACKAGE_MANAGERS = [
    {
        value: "pnpm",
        label: "pnpm",
        devCommand: "pnpm dev",
        installCommand: "pnpm install",
        runCommand: "pnpm",
        testCommand: "pnpm test",
        isRecommended: true,
    },
    {
        value: "npm",
        label: "npm",
        devCommand: "npm run dev",
        installCommand: "npm install",
        runCommand: "npm run",
        testCommand: "npm test",
        isRecommended: false,
    },
    {
        value: "yarn",
        label: "yarn",
        devCommand: "yarn dev",
        installCommand: "yarn install",
        runCommand: "yarn",
        testCommand: "yarn test",
        isRecommended: false,
    },
] as const;

const PACKAGE_MANAGER_VALUES: PackageManager[] = PACKAGE_MANAGERS.map((manager) => manager.value);
const PACKAGE_MANAGER_FLAG_DESCRIPTION = `Package manager (${PACKAGE_MANAGER_VALUES.join(", ")})`;

const isKnownPackageManager = (name: string): name is PackageManager =>
    (PACKAGE_MANAGER_VALUES as string[]).includes(name);

export {
    PACKAGE_MANAGERS,
    PACKAGE_MANAGER_FLAG_DESCRIPTION,
    PACKAGE_MANAGER_VALUES,
    isKnownPackageManager,
    type PackageManager,
};
