import { errorMessage, info } from "@gtkx/utils";
import { defineCommand } from "citty";
import { writeReleaseAgeExemptions } from "create-gtkx";
import { relative } from "node:path";
import { cwdArg, resolveCwd } from "../internal/entry-arg.js";
import {
    dedupeWorkspace,
    detectInstaller,
    type Installer,
    installWorkspace,
    resolveTargetVersion,
} from "../upgrade/package-manager.js";
import { snapshotUpgradeFiles } from "../upgrade/snapshot.js";
import { excludingPeerRanges, planUpgrade, type UpgradePlan } from "../upgrade/specs.js";
import { installedGtkxPackages } from "../upgrade/version-skew.js";
import { findWorkspace, type Workspace } from "../upgrade/workspace.js";
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

/**
 * Exempts GTKX's packages from the release-age gate in the workspace root's package manager settings, so a
 * release published within the gate installs. Yarn 1 has no such gate.
 */
const exemptFromReleaseAgeGate = (installer: Installer): void => {
    const changed = installer.isYarnClassic ? [] : writeReleaseAgeExemptions(installer.root, installer.name);

    for (const file of changed) {
        info(`upgrade: ${relative(installer.root, file)} exempts @gtkx/* and create-gtkx from the release-age gate`);
    }
};

/**
 * Installs the upgraded workspace, putting back the files the upgrade changed when the install fails.
 */
const installOrRestore = async (installer: Installer, restore: () => string[]): Promise<void> => {
    try {
        await installWorkspace(installer);
    } catch (error) {
        const restored = restore().map((file) => relative(installer.root, file));

        throw new Error(
            restored.length === 0
                ? errorMessage(error)
                : `${errorMessage(error)} gtkx upgrade restored ${restored.join(", ")} as they were.`,
            { cause: error },
        );
    }
};

const assertInstalledVersion = (workspace: Workspace, version: string): void => {
    const stale = [
        ...new Set(
            workspace.members
                .flatMap((member) => installedGtkxPackages(member))
                .filter((installed) => installed.version !== version)
                .map((installed) => `${installed.name} ${installed.version}`),
        ),
    ].sort();

    if (stale.length > 0) {
        throw new Error(
            `The installed GTKX packages are not all on ${version}: ${stale.join(", ")}. ` +
                "A spec gtkx upgrade does not rewrite still selects them, such as a Yarn catalog, overrides, " +
                `resolutions or a range that also accepts newer releases. Set it to ${version} and install again.`,
        );
    }

    const peers = excludingPeerRanges(workspace, version);

    if (peers.length > 0) {
        throw new Error(
            `These GTKX peer dependency ranges do not accept ${version}: ${peers.join(", ")}. ` +
                `Change them to accept ${version}.`,
        );
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
        const snapshot = snapshotUpgradeFiles(workspace);
        plan.write();
        exemptFromReleaseAgeGate(installer);
        info(`upgrade: installing with ${installer.name}`);
        await installOrRestore(installer, snapshot.restore);
        await dedupeWorkspace(installer);
        assertInstalledVersion(workspace, version);
        info(`upgrade: GTKX packages are on ${version}`);
    },
});

export { upgrade };
