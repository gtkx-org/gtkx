import { sortStrings } from "@gtkx/utils";
import type { DeployTarget, DeployTargetName } from "./types.js";
import { appimageTarget } from "./targets/appimage.js";
import { debTarget } from "./targets/deb.js";
import { flatpakTarget } from "./targets/flatpak.js";
import { rpmTarget } from "./targets/rpm.js";

const TARGETS: Record<DeployTargetName, DeployTarget> = {
    appimage: appimageTarget,
    deb: debTarget,
    flatpak: flatpakTarget,
    rpm: rpmTarget,
};

const DEFAULT_TARGETS: DeployTargetName[] = ["flatpak"];
const KNOWN_NAMES = sortStrings(Object.keys(TARGETS)).join(", ");

const isTargetName = (name: string): name is DeployTargetName => Object.hasOwn(TARGETS, name);

const assertKnown = (name: string): DeployTargetName => {
    if (!isTargetName(name)) {
        throw new Error(`Unknown deploy target "${name}"; known targets are ${KNOWN_NAMES}`);
    }

    return name;
};

const targetsFor = (names: string[]): DeployTarget[] => {
    const requested = [...new Set(names.map((name) => assertKnown(name.trim())))];

    if (requested.length === 0) {
        throw new Error(`Cannot deploy without a target; choose from ${KNOWN_NAMES}`);
    }

    return sortStrings(requested).map((name) => TARGETS[assertKnown(name)]);
};

const parseTargetList = (value: string): string[] => value.split(",").map((name) => name.trim()).filter(Boolean);

export { DEFAULT_TARGETS, KNOWN_NAMES, parseTargetList, targetsFor };
