import type { ProcessIdentity } from "@gtkx/utils";

const BUS_CONFIG_DOCTYPE =
    '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
    '"https://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">';

const HEADLESS_RUNTIME_MARKER = ".gtkx-headless-runtime";
const HEADLESS_HELPER_ENV = "GTKX_HEADLESS_RUNTIME";

const swayConfigLines = (resolution: string): string[] => [
    "xwayland disable",
    "default_border none",
    "default_floating_border none",
    `output HEADLESS-1 resolution ${resolution}`,
    "output HEADLESS-1 bg #000000 solid_color",
    'for_window [app_id=".*"] floating enable, border none',
    'for_window [title=".*"] floating enable, border none',
    "",
];

const createSwayConfig = (width: string, height: string): string => swayConfigLines(`${width}x${height}`).join("\n");

const createBusConfig = (busSocketPath: string): string =>
    [
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

type HeadlessRuntimeState = { owner: ProcessIdentity; helpers: ProcessIdentity[] };

const createHeadlessRuntimeMarker = (
    runtimeDir: string,
    owner: ProcessIdentity,
    helpers: readonly ProcessIdentity[] = [],
): string =>
    [
        "gtkx-headless-runtime-v2",
        `runtime=${runtimeDir}`,
        `owner=${String(owner.pid)}:${owner.startTime}`,
        ...helpers.map((helper) => `helper=${String(helper.pid)}:${helper.startTime}`),
        "",
    ].join("\n");

const readIdentity = (line: string, prefix: string): ProcessIdentity | undefined => {
    if (!line.startsWith(prefix)) return undefined;
    const match = /^([1-9]\d*):([0-9]+)$/.exec(line.slice(prefix.length));
    const pid = Number(match?.[1]);
    const startTime = match?.[2];
    return Number.isSafeInteger(pid) && pid > 0 && startTime !== undefined ? { pid, startTime } : undefined;
};

const readHeadlessRuntimeState = (runtimeDir: string, marker: string | undefined): HeadlessRuntimeState | undefined => {
    if (marker === undefined) return undefined;
    const lines = marker.split("\n");
    const owner = readIdentity(lines[2] ?? "", "owner=");
    if (owner === undefined) return undefined;
    const helpers: ProcessIdentity[] = [];
    for (const line of lines.slice(3, -1)) {
        const helper = readIdentity(line, "helper=");
        if (helper === undefined || helper.pid <= 1 || helper.pid === owner.pid) return undefined;
        helpers.push(helper);
    }
    return marker === createHeadlessRuntimeMarker(runtimeDir, owner, helpers) ? { owner, helpers } : undefined;
};

const isSwayConfig = (value: string): boolean => {
    const lines = value.split("\n");
    const resolution = /^output HEADLESS-1 resolution ([1-9]\d*x[1-9]\d*)$/.exec(lines[3] ?? "")?.[1];

    return resolution !== undefined && value === swayConfigLines(resolution).join("\n");
};

export {
    createBusConfig,
    createHeadlessRuntimeMarker,
    createSwayConfig,
    HEADLESS_HELPER_ENV,
    HEADLESS_RUNTIME_MARKER,
    isSwayConfig,
    readHeadlessRuntimeState,
};
