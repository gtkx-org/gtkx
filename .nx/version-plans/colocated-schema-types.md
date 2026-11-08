---
__default__: major
---

GSettings schema imports are now typed by a `<name>.gschema.d.xml.ts` that `gtkx codegen`, `gtkx dev` and `gtkx build` write beside each `.gschema.xml`, instead of wildcard declarations in `node_modules/.gtkx/env.d.ts`. An import with a wrong path now fails `tsc`, and schemas with the same file name in different directories get their own types. TypeScript reads these files only with `"allowArbitraryExtensions": true`, so add it to `compilerOptions` in `tsconfig.json` and add `*.d.xml.ts` to `.gitignore`; new projects get both, and codegen warns while a project with schemas lacks the option, linking to the upgrade guide section on it.
