---
__default__: patch
---

`@gtkx/cli/vitest-plugin` now runs the tests of a package that is not an application, such as a component library, without a `gtkx.config.ts` or without an `applicationId` in it, as the application `org.gtkx.Test`. It used to stop with "no configuration file found" or "applicationId is required". The guide has a new Component libraries section on building, testing and publishing such a package.
