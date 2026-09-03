type PackageManager = (typeof PACKAGE_MANAGERS)[number]["value"];

const PACKAGE_MANAGERS = [
    {
        value: "pnpm",
        label: "pnpm",
        devCommand: "pnpm dev",
        addCommand: "pnpm add",
        installCommand: "pnpm install",
        isRecommended: true,
    },
    {
        value: "npm",
        label: "npm",
        devCommand: "npm run dev",
        addCommand: "npm install",
        installCommand: "npm install",
        isRecommended: false,
    },
    {
        value: "yarn",
        label: "yarn",
        devCommand: "yarn dev",
        addCommand: "yarn add",
        installCommand: "yarn install",
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
