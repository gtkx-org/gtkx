---
__default__: patch
---

A relative `module` in an `elements.config` entry's `props` or `component`, such as `"./src/source-view-props.ts"`, now resolves from the project root in the generated JSX bindings, as it already did in the reference pages. The generated declarations used to import it relative to the binding store, where it did not exist, so the element's props silently lost their types.
