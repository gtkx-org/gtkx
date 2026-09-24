import { config } from "@gtkx/eslint";
import api from "./api.json" with { type: "json" };

export default [
    ...config(import.meta.dirname, api),
    {
        files: ["examples/tutorial/src/gtkx-env.d.ts"],
        rules: {
            "@typescript-eslint/triple-slash-reference": "off",
        },
    },
    {
        files: ["examples/tutorial/src/navigation.ts"],
        rules: { "@typescript-eslint/consistent-type-definitions": "off" },
    },
    {
        files: [
            "examples/tutorial/tests/application-actions.test.tsx",
            "examples/tutorial/tests/notifications.test.tsx",
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
            "sonarjs/no-alphabetical-sort": "off",
        },
    },
    {
        files: [
            "packages/codegen/src/docs/api-reference.ts",
            "packages/codegen/src/store/jsx/element-prop-imports.ts",
            "packages/runtime/src/property-types.ts",
            "packages/runtime/src/registry.ts",
            "packages/runtime/src/descriptor-types.ts",
            "packages/runtime/src/field.ts",
            "packages/runtime/src/object.ts",
            "packages/runtime/src/register-class.ts",
            "packages/runtime/src/signal-brand.ts",
            "packages/runtime/src/signal.ts",
            "packages/react/src/reconciler/registry.ts",
            "packages/react/src/prop-types.ts",
            "packages/react/src/hooks/use-bind-setting.ts",
            "packages/react/src/utils/settings.ts",
            "packages/testing/src/types.ts",
        ],
        rules: { "gtkx/public-api-jsdoc": "off" },
    },
];
