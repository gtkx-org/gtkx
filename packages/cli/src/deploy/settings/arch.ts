import type { DeployArch } from "../types.js";

const ARCH_TABLE: Record<string, DeployArch> = {
    arm64: { deb: "arm64", rpm: "aarch64", flatpak: "aarch64", appimage: "aarch64", node: "arm64" },
    x64: { deb: "amd64", rpm: "x86_64", flatpak: "x86_64", appimage: "x86_64", node: "x64" },
};

const resolveArch = (arch: string = process.arch): DeployArch => {
    const resolved = ARCH_TABLE[arch];

    if (resolved === undefined) {
        throw new Error(`Cannot deploy for ${arch}: only ${Object.keys(ARCH_TABLE).join(" and ")} are supported`);
    }

    return resolved;
};

export { resolveArch };
