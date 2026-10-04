import { config } from "@gtkx/eslint";

export default [
    ...config(import.meta.dirname),
    {
        files: ["tutorial/src/gtkx-env.d.ts"],
        rules: {
            "@typescript-eslint/triple-slash-reference": "off",
        },
    },
    {
        files: ["tutorial/src/navigation.ts"],
        rules: { "@typescript-eslint/consistent-type-definitions": "off" },
    },
    {
        files: [
            "tutorial/tests/application-actions.test.tsx",
            "tutorial/tests/notifications.test.tsx",
        ],
        rules: { "no-empty-pattern": "off" },
    },
    {
        files: [
            "packages/runtime/tests/fixtures/process-exit-owner.ts",
            "packages/runtime/tests/fixtures/process-exit-closure.ts",
        ],
        rules: { "unicorn/no-process-exit": "off" },
    },
    {
        files: ["packages/codegen/src/fingerprint.ts"],
        rules: {
            "unicorn/require-array-sort-compare": "off",
        },
    },
];
