import { resolveExecutable } from "@gtkx/utils";
import { execFileSync } from "node:child_process";

const hasTool = (name: string): boolean => {
    try {
        execFileSync(resolveExecutable(name), ["--version"], { stdio: ["ignore", "ignore", "ignore"] });

        return true;
    } catch {
        return process.env.CI === undefined ? false : missingInCi(name);
    }
};

const missingInCi = (name: string): never => {
    throw new Error(`${name} is missing from the CI image, so its deploy tests would silently never run`);
};

const hasAppstreamCli = (): boolean => hasTool("appstreamcli");
const hasDesktopFileValidate = (): boolean => hasTool("desktop-file-validate");
const hasFlatpakBuilder = (): boolean => hasTool("flatpak-builder");

export { hasAppstreamCli, hasDesktopFileValidate, hasFlatpakBuilder };
