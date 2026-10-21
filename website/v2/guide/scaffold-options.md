---
title: "Scaffold Options"
description: "Create projects without prompts, defer dependency installation, and replace scaffold files."
---

# Scaffold Options

For an interactive first project, follow [Getting Started](/v2/guide/getting-started). Use these options to script project creation:

```bash
npm create gtkx@beta -- my-app --yes --application-id com.example.MyApp --display-name "My App"
```

Without `--display-name`, noninteractive scaffolding derives a name from the project directory, so `my-app` becomes `My App`. `--skip-install` writes the project without installing dependencies; run your package manager's install command in that directory afterward.

## Existing directories

Without `--overwrite`, an existing scaffold-owned file stops the command before it changes anything. `--overwrite` lists and replaces only files owned by the scaffold; unrelated files remain in place. The command refuses a destination reached through a symbolic link.

## Installation failures

If dependency installation fails, the generated project remains on disk. Resolve the package manager's error, then rerun its install command in the project directory. Recreating the project is unnecessary.

For the complete option list, run:

```bash
npm create gtkx@beta -- --help
```
