import {
    type CleanupDirectoryIdentity,
    cleanupDirectoryIdentity,
    killProcessGroup,
    type ProcessGroupIdentity,
    processGroupIdentity,
    removeCleanupDirectory,
    resolveExecutable,
} from "@gtkx/utils";
import { lstatSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";

type ProcessIdentity = {
    parentId: number;
    processGroupId: number;
    sessionId: number;
    startTime: string;
};

type LegacyHeadlessDisplay = {
    pid: number;
    runtimeDir: string;
    startTime: string;
    cleanupDirectory: CleanupDirectoryIdentity;
};

const RUNTIME_DIRECTORY_PATTERN = /^gtkx-xdg-[A-Za-z0-9]{6}$/;
const SWAY_CONFIG_LINES = [
    /^xwayland disable$/,
    /^default_border none$/,
    /^default_floating_border none$/,
    /^output HEADLESS-1 resolution [1-9]\d*x[1-9]\d*$/,
    /^output HEADLESS-1 bg #000000 solid_color$/,
    /^for_window \[app_id="\.\*"\] floating enable, border none$/,
    /^for_window \[title="\.\*"\] floating enable, border none$/,
    /^$/,
];
const BUS_CONFIG_DOCTYPE =
    '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
    '"https://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">';

const readProcessArguments = (pid: number): string[] =>
    readFileSync(`/proc/${String(pid)}/cmdline`)
        .toString()
        .split("\0")
        .filter((argument) => argument.length > 0);

const readProcessIdentity = (pid: number): ProcessIdentity | undefined => {
    try {
        const stat = readFileSync(`/proc/${String(pid)}/stat`, "utf8");
        const fields = stat.slice(stat.lastIndexOf(") ") + 2).split(" ");
        const parentId = Number(fields[1]);
        const processGroupId = Number(fields[2]);
        const sessionId = Number(fields[3]);
        const startTime = fields[19];

        if (
            startTime === undefined ||
            [parentId, processGroupId, sessionId].some((value) => !Number.isSafeInteger(value))
        ) {
            return undefined;
        }

        return { parentId, processGroupId, sessionId, startTime };
    } catch {
        return undefined;
    }
};

const isUserProcess = (path: string): boolean => {
    const getuid = process.getuid;

    return getuid !== undefined && lstatSync(path).uid === getuid();
};

const isOrphanParent = (parentId: number): boolean => {
    if (parentId === 1) {
        return true;
    }

    try {
        const identity = readProcessIdentity(parentId);
        const args = readProcessArguments(parentId);

        return (
            identity?.parentId === 1 &&
            isUserProcess(`/proc/${String(parentId)}`) &&
            basename(args[0] ?? "") === "systemd" &&
            args.includes("--user")
        );
    } catch {
        return false;
    }
};

const isPrivateRuntimeDirectory = (runtimeDir: string): boolean => {
    try {
        const stat = lstatSync(runtimeDir);

        return (
            stat.isDirectory() &&
            isUserProcess(runtimeDir) &&
            (stat.mode & 0o777) === 0o700 &&
            (RUNTIME_DIRECTORY_PATTERN.exec(basename(runtimeDir))) !== null &&
            dirname(realpathSync(runtimeDir)) === realpathSync(tmpdir())
        );
    } catch {
        return false;
    }
};

const isGeneratedSwayConfig = (configPath: string, runtimeDir: string): boolean => {
    try {
        const stat = lstatSync(configPath);

        const lines = readFileSync(configPath, "utf8").split("\n");

        return (
            stat.isFile() &&
            isUserProcess(configPath) &&
            stat.size < 2048 &&
            realpathSync(configPath) === join(realpathSync(runtimeDir), "sway.conf") &&
            lines.length === SWAY_CONFIG_LINES.length &&
            SWAY_CONFIG_LINES.every((pattern, index) => pattern.test(lines[index] ?? "invalid"))
        );
    } catch {
        return false;
    }
};

const isGeneratedBusConfig = (configPath: string, runtimeDir: string): boolean => {
    try {
        const stat = lstatSync(configPath);
        const busSocketPath = join(runtimeDir, "bus");
        const expected = [
            BUS_CONFIG_DOCTYPE,
            "<busconfig>",
            "  <type>session</type>",
            `  <listen>unix:path=${busSocketPath}</listen>`,
            "  <auth>EXTERNAL</auth>",
            '  <policy context="default">',
            '    <allow send_destination="*" eavesdrop="true"/>',
            '    <allow eavesdrop="true"/>',
            '    <allow own="*"/>',
            "  </policy>",
            "</busconfig>",
        ].join("\n");

        return (
            stat.isFile() &&
            isUserProcess(configPath) &&
            stat.size < 2048 &&
            realpathSync(configPath) === join(realpathSync(runtimeDir), "session.conf") &&
            readFileSync(configPath, "utf8") === expected
        );
    } catch {
        return false;
    }
};

const findSwayExecutable = (): string | undefined => {
    try {
        return realpathSync(resolveExecutable("sway"));
    } catch {
        return undefined;
    }
};

const classifyProcess = (pid: number, swayExecutable: string): LegacyHeadlessDisplay | undefined => {
    try {
        const args = readProcessArguments(pid);

        if (args.length !== 3 || args[1] !== "-c" || realpathSync(args[0] ?? "") !== swayExecutable) {
            return undefined;
        }

        const identity = readProcessIdentity(pid);

        if (
            identity?.processGroupId !== pid ||
            identity.sessionId !== pid ||
            !isOrphanParent(identity.parentId) ||
            !isUserProcess(`/proc/${String(pid)}`)
        ) {
            return undefined;
        }

        const configPath = args[2] ?? "";
        const runtimeDir = dirname(configPath);

        if (
            basename(configPath) !== "sway.conf" ||
            !isPrivateRuntimeDirectory(runtimeDir) ||
            !isGeneratedSwayConfig(configPath, runtimeDir)
        ) {
            return undefined;
        }

        const cleanupDirectory = cleanupDirectoryIdentity(runtimeDir);

        return cleanupDirectory === undefined
            ? undefined
            : { pid, runtimeDir, startTime: identity.startTime, cleanupDirectory };
    } catch {
        return undefined;
    }
};

const findLegacyHeadlessDisplays = (): LegacyHeadlessDisplay[] => {
    const swayExecutable = findSwayExecutable();

    if (swayExecutable === undefined) {
        return [];
    }

    return readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1 && pid !== process.pid)
        .map((pid) => classifyProcess(pid, swayExecutable))
        .filter((entry): entry is LegacyHeadlessDisplay => entry !== undefined);
};

const findRuntimeBusGroups = (runtimeDir: string): ProcessGroupIdentity[] => {
    let executable: string;

    try {
        executable = realpathSync(resolveExecutable("dbus-daemon"));
    } catch {
        return [];
    }

    const configPath = join(runtimeDir, "session.conf");

    if (!isGeneratedBusConfig(configPath, runtimeDir)) {
        return [];
    }

    return readdirSync("/proc")
        .map(Number)
        .filter((pid) => Number.isSafeInteger(pid) && pid > 1 && pid !== process.pid)
        .flatMap((pid): ProcessGroupIdentity[] => {
            try {
                const args = readProcessArguments(pid);
                const identity = readProcessIdentity(pid);
                const group = processGroupIdentity(pid);

                return args.length === 2 &&
                    args[1] === `--config-file=${configPath}` &&
                    realpathSync(args[0] ?? "") === executable &&
                    identity?.processGroupId === pid &&
                    identity.sessionId === pid &&
                    isOrphanParent(identity.parentId) &&
                    isUserProcess(`/proc/${String(pid)}`) &&
                    group?.leaderStartTime === identity.startTime
                    ? [group]
                    : [];
            } catch {
                return [];
            }
        });
};

const reapCandidate = (candidate: LegacyHeadlessDisplay, swayExecutable: string): void => {
    const current = classifyProcess(candidate.pid, swayExecutable);

    if (current?.runtimeDir !== candidate.runtimeDir || current.startTime !== candidate.startTime) {
        return;
    }

    const swayGroup = processGroupIdentity(candidate.pid);

    if (swayGroup?.leaderStartTime !== candidate.startTime) {
        return;
    }

    for (const busGroup of findRuntimeBusGroups(candidate.runtimeDir)) {
        killProcessGroup(busGroup);
    }

    killProcessGroup(swayGroup);

    removeCleanupDirectory(candidate.cleanupDirectory);
};

const reapLegacyHeadlessDisplays = (candidates: readonly LegacyHeadlessDisplay[]): void => {
    const swayExecutable = findSwayExecutable();

    if (swayExecutable === undefined) {
        return;
    }

    for (const candidate of candidates) {
        reapCandidate(candidate, swayExecutable);
    }
};

export { findLegacyHeadlessDisplays, reapLegacyHeadlessDisplays, type LegacyHeadlessDisplay };
