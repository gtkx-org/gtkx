import { sortStrings } from "@gtkx/utils";
import type { DeployArch, DeployArchName } from "../types.js";

const EM_X86_64 = 62;
const EM_AARCH64 = 183;

const ARCH_TABLE: Record<DeployArchName, DeployArch> = {
    arm64: { deb: "arm64", rpm: "aarch64", flatpak: "aarch64", appimage: "aarch64", node: "arm64" },
    x64: { deb: "amd64", rpm: "x86_64", flatpak: "x86_64", appimage: "x86_64", node: "x64" },
};

const ELF_MACHINE_TABLE: Record<DeployArchName, number> = {
    arm64: EM_AARCH64,
    x64: EM_X86_64,
};

const KNOWN_ARCH_NAMES = sortStrings(Object.keys(ARCH_TABLE)).join(", ");

const isArchName = (name: string): name is DeployArchName => Object.hasOwn(ARCH_TABLE, name);

const assertKnownArch = (name: string): DeployArchName => {
    if (!isArchName(name)) {
        throw new Error(`Cannot deploy for ${name}: only ${KNOWN_ARCH_NAMES} are supported`);
    }

    return name;
};

const resolveArch = (name: DeployArchName): DeployArch => ARCH_TABLE[name];

const hostArchName = (): DeployArchName => assertKnownArch(process.arch);

const isHostArch = (name: DeployArchName): boolean => name === hostArchName();

const elfMachineFor = (name: DeployArchName): number => ELF_MACHINE_TABLE[name];

const parseArchList = (value: string): string[] => value.split(",").map((name) => name.trim()).filter(Boolean);

const archesFor = (names: string[]): [DeployArchName, ...DeployArchName[]] => {
    const requested = sortStrings(new Set(names.map((name) => assertKnownArch(name.trim()))));
    const [first, ...rest] = requested.map((name) => assertKnownArch(name));

    if (first === undefined) {
        throw new Error(`Cannot deploy without an architecture; choose from ${KNOWN_ARCH_NAMES}`);
    }

    return [first, ...rest];
};

export { archesFor, elfMachineFor, hostArchName, isHostArch, KNOWN_ARCH_NAMES, parseArchList, resolveArch };
