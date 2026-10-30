---
__default__: patch
---

`gtkx storybook` now accepts story globs that reach a sibling workspace package, such as `"../../packages/ui/src/**/*.stories.tsx"` in an app's `.storybook/main.ts`, as long as every file they match lies inside the workspace root, the directory Vite already serves linked packages from. A pattern containing `..` used to stop the explorer with "Storybook stories must contain project-relative glob patterns". Stories outside the workspace root are still rejected, and the default `node_modules`, `dist` and `build` exclusions also apply below such a pattern.
