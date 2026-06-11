import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");

export interface PackageConfig {
    name: string;
    entryPoints: string[];
    tsconfig: string;
    intentionallyNotExported: string[];
}

export const packages: PackageConfig[] = [
    {
        name: "react",
        entryPoints: [resolve(root, "packages/react/src/index.ts")],
        tsconfig: resolve(root, "packages/react/tsconfig.lib.json"),
        intentionallyNotExported: [
            "ReconcilerInstance",
            "GtkColumnViewBase",
            "SettingTypeMap",
            "ColumnViewSortProps",
            "ListViewControlledSelectionProps",
            "ListViewSharedProps",
            "UncontrolledItemType",
            "AnySignalHandler",
            "AnySignalHandlers",
            "ActionAccelsProps",
            "ActionScopeProps",
            "ApplicationComponentProps",
            "ApplicationOf",
        ],
    },
    {
        name: "animate",
        entryPoints: [resolve(root, "packages/animate/src/index.ts")],
        tsconfig: resolve(root, "packages/animate/tsconfig.lib.json"),
        intentionallyNotExported: ["AnimationBaseProps"],
    },
    {
        name: "css",
        entryPoints: [resolve(root, "packages/css/src/index.ts")],
        tsconfig: resolve(root, "packages/css/tsconfig.lib.json"),
        intentionallyNotExported: ["CssClassName"],
    },
    {
        name: "testing",
        entryPoints: [resolve(root, "packages/testing/src/index.ts")],
        tsconfig: resolve(root, "packages/testing/tsconfig.lib.json"),
        intentionallyNotExported: ["ElementOrCallback"],
    },
    {
        name: "ffi",
        entryPoints: [resolve(root, "packages/ffi/src/index.ts")],
        tsconfig: resolve(root, "packages/ffi/tsconfig.lib.json"),
        intentionallyNotExported: ["GType", "ParamSpec"],
    },
];
