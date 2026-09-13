const BUS_CONFIG_DOCTYPE =
    '<!DOCTYPE busconfig PUBLIC "-//freedesktop//DTD D-BUS Bus Configuration 1.0//EN" ' +
    '"https://www.freedesktop.org/standards/dbus/1.0/busconfig.dtd">';

const HEADLESS_RUNTIME_MARKER = ".gtkx-headless-runtime";

const swayConfigLines = (resolution: string): string[] =>
    [
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

const createHeadlessRuntimeMarker = (runtimeDir: string): string =>
    ["gtkx-headless-runtime-v1", `runtime=${runtimeDir}`, ""].join("\n");

const isSwayConfig = (value: string): boolean => {
    const lines = value.split("\n");
    const resolution = /^output HEADLESS-1 resolution ([1-9]\d*x[1-9]\d*)$/.exec(lines[3] ?? "")?.[1];

    return resolution !== undefined && value === swayConfigLines(resolution).join("\n");
};

export {
    createBusConfig,
    createHeadlessRuntimeMarker,
    createSwayConfig,
    HEADLESS_RUNTIME_MARKER,
    isSwayConfig,
};
