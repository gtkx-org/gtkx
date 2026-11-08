---
title: "Releases"
description: "Which GTKX release lines receive updates, what prereleases may change, and how deprecated APIs are removed."
---

# Releases

Every GTKX package, `create-gtkx` included, is released under one version number, and a project keeps them all on the same release. Releases follow no fixed schedule: each one ships when its changes are ready. To follow them, watch the [changelog](https://github.com/gtkx-org/gtkx/releases), which lists the changes in each release, or read the release announcements on the [blog](/blog/). [Updating GTKX](/v2/guide/updating) moves a project to a newer one.

## Supported versions

| Line | Status                                          | npm dist-tag | Security updates                              |
| ---- | ----------------------------------------------- | ------------ | --------------------------------------------- |
| 2.x  | Beta; the stable release is due 1 December 2026 | `beta`       | Included before the stable release            |
| 1.x  | Stable                                          | `latest`     | The latest 1.x release, until 1 December 2026 |

From 1 December 2026, security updates go to the latest 2.x release and support for 1.x ends; [Upgrading to 2.0](/v2/guide/upgrading-to-2) covers the move. Only the latest release of a line receives security updates, and releases before 1.0 receive none. Report vulnerabilities as the [security policy](https://github.com/gtkx-org/gtkx/security/policy) describes, including those that affect a 2.0 beta.

## Prereleases

A prerelease, such as `2.0.0-beta.12`, can break code written for an earlier prerelease of the same version. An API introduced during a beta can be changed or removed in a later beta without first being deprecated. The changelog lists each of these changes under Breaking Changes.

A new project depends on `^` ranges of the release that created it, which also accept later prereleases and the stable release. Commit the lockfile so every install gets the release you tested, and read the changelog before moving to a newer prerelease with `gtkx upgrade`. To pin a release exactly, remove the `^`: `gtkx upgrade` keeps each dependency's range operator.

## Deprecations

A stable API is removed only in a major release, after an earlier minor release has warned about it. A renamed API keeps working under its old name, marked `@deprecated` with the release that deprecated it, so editors flag it. A behavior change prints a warning from the CLI and offers an opt-in to the new behavior. GTKX 1.6 was that minor release for 2.0; [Prepare on 1.6](/guide/upgrading-to-2#prepare-on-1-6) lists its warnings.

Some APIs deprecated in a major release keep working until the next one. The slot props `topBar`, `bottomBar` and `overlays`, renamed in 2.0, are removed in 3.0.

## Release notes and upgrade guides

- The [changelog](https://github.com/gtkx-org/gtkx/releases) has the notes for every release, with breaking changes listed separately.
- The [blog](/blog/) has release announcements.
- [Upgrading to 2.0](/v2/guide/upgrading-to-2) moves a 1.x project to 2.0.
