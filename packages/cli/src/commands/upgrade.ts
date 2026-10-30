import { info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { relative } from "node:path";
import { cwdArg, resolveCwd } from "../internal/entry-arg.js";
import { detectInstaller, installWorkspace, resolveTargetVersion } from "../upgrade/package-manager.js";
import { planUpgrade, type UpgradePlan } from "../upgrade/specs.js";
import { findWorkspace } from "../upgrade/workspace.js";
import packageManifest from "../../package.json" with { type: "json" };

const report = (root: string, plan: UpgradePlan): void => {
    for (const change of plan.changes) {
        info(
            `upgrade: ${relative(root, change.file)} ${change.location} ${change.name} ${change.from} -> ${change.to}`,
        );
    }

    for (const kept of plan.kept) {
        info(`upgrade: ${relative(root, kept.file)} keeps ${kept.name} at ${kept.spec}`);
    }
};

const upgrade = defineCommand({
    meta: {
        name: "upgrade",
        description: "Move every GTKX package in the project or its workspace to one version and install it",
    },
    args: {
        version: {
            type: "positional",
            description: "Version or dist-tag to move to (default: the newest release on the project's dist-tag)",
            required: false,
        },
        ...cwdArg,
    },
    async run({ args }) {
        const workspace = findWorkspace(resolveCwd(args));
        const installer = await detectInstaller(workspace.root);
        const version = await resolveTargetVersion(installer, args.version, packageManifest.version);
        const plan = planUpgrade(workspace, version);
        info(`upgrade: moving GTKX packages to ${version}`);
        report(workspace.root, plan);
        plan.write();
        info(`upgrade: installing with ${installer.name}`);
        await installWorkspace(installer);
        info(`upgrade: GTKX packages are on ${version}`);
    },
});

export { upgrade };
