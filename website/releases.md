---
title: "Releases"
description: "When GTKX releases ship, which release lines receive updates, what prereleases may change, and how deprecated APIs are removed."
---

# Releases

Every GTKX package, `create-gtkx` included, is released under one version number, and a project keeps them all on the same release. To follow releases, watch the [changelog](https://github.com/gtkx-org/gtkx/releases), which lists the changes in each release, or read the release announcements on the [blog](/blog/). [Updating GTKX](/v2/guide/updating) moves a project to a newer one.

## Release schedule

- **Major releases** ship every six months, shortly after each GNOME release in March and September. A major release adds no features: it removes APIs that an earlier minor release deprecated, makes opt-in behaviors the default, and raises the minimum supported versions of Node.js and GNOME. GTKX 3.0 is due in March 2027.
- **Minor releases** ship when their changes are ready. They add features, deprecate APIs and introduce new behaviors as opt-ins.
- **Patch releases** fix bugs.

A project that runs without deprecation warnings on the last minor release of a line can move to the next major release without other changes.

## Supported versions

| Line | Status                                          | npm dist-tag | Security updates                              |
| ---- | ----------------------------------------------- | ------------ | --------------------------------------------- |
| 2.x  | Beta; the stable release is due 1 December 2026 | `beta`       | Included before the stable release            |
| 1.x  | Stable                                          | `latest`     | The latest 1.x release, until 1 December 2026 |

From 1 December 2026, security updates go to the latest 2.x release and support for 1.x ends; [Upgrading to 2.0](/v2/guide/upgrading-to-2) covers the move. From 3.0 on, the previous major line keeps receiving security updates for three months after the next major release ships. Only the latest release of a line receives security updates, and releases before 1.0 receive none. Report vulnerabilities as the [security policy](https://github.com/gtkx-org/gtkx/security/policy) describes, including those that affect a 2.0 beta.

## Prereleases

A prerelease, such as `2.0.0-beta.12`, can break code written for an earlier prerelease of the same version. An API introduced during a beta can be changed or removed in a later beta without first being deprecated. The changelog lists each of these changes under Breaking Changes.

A new project depends on `^` ranges of the release that created it, which also accept later prereleases and the stable release. Commit the lockfile so every install gets the release you tested, and read the changelog before moving to a newer prerelease with `gtkx upgrade`. To pin a release exactly, remove the `^`: `gtkx upgrade` keeps each dependency's range operator.

## Deprecations

A stable API is removed only in a major release, after an earlier minor release has warned about it. A renamed API keeps working under its old name, marked `@deprecated` with the release that deprecated it, so editors flag it. A behavior change prints a warning from the CLI and offers an opt-in to the new behavior. GTKX 1.6 was that minor release for 2.0; [Prepare on 1.6](/guide/upgrading-to-2#prepare-on-1-6) lists its warnings.

A major release never deprecates an API. GTKX 2.0 predates the release schedule, so it also renames and removes some APIs that 1.6 did not warn about; [Upgrading to 2.0](/v2/guide/upgrading-to-2) lists them.

## Release notes and upgrade guides

- The [changelog](https://github.com/gtkx-org/gtkx/releases) has the notes for every release, with breaking changes listed separately.
- The [blog](/blog/) has release announcements.
- [Upgrading to 2.0](/v2/guide/upgrading-to-2) moves a 1.x project to 2.0.
