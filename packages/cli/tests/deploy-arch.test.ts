import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { parse } from "yaml";
import { createCliProject, removeCliProject, runCli } from "./cli-project.ts";
import {
    BINARY_NAME,
    config,
    DEPLOY_BLOCK,
    DEPLOY_FIELDS,
    deployProbe,
    expectSuccessfulDeploy,
    OUT_DIR,
    projectFiles,
} from "./deploy-helpers.ts";

type NfpmArch = { arch: string };

const OFFSET_MACHINE = 0x12;
const EM_X86_64 = 62;
const EM_AARCH64 = 183;
const HOST_ARCH = process.arch === "arm64" ? "arm64" : "x64";
const FOREIGN_ARCH = HOST_ARCH === "x64" ? "arm64" : "x64";
const MACHINE_FOR: Record<string, number> = { arm64: EM_AARCH64, x64: EM_X86_64 };
const BINDING_FILENAME = "gtkx.node";
const STAGED_BINDING = join("stage", "lib", BINARY_NAME, BINDING_FILENAME);

const hostAddon = (): Buffer =>
    readFileSync(fileURLToPath(new URL(`../../native/native.linux-${HOST_ARCH}-gnu.node`, import.meta.url)));

const addonBuiltFor = (arch: string): Buffer => {
    const bytes = hostAddon();
    bytes.writeUInt16LE(MACHINE_FOR[arch] ?? 0, OFFSET_MACHINE);

    return bytes;
};

const addonPackage = (arch: string, builtFor: string = arch): Record<string, string | Buffer> => {
    const name = `@gtkx/native-linux-${arch}-gnu`;
    const dir = join("node_modules", "@gtkx", `native-linux-${arch}-gnu`);
    const binary = `native.linux-${arch}-gnu.node`;
    const manifest = JSON.stringify({ name, version: "0.0.0", main: binary });

    return {
        [join(dir, "package.json")]: `${manifest}\n`,
        [join(dir, binary)]: addonBuiltFor(builtFor),
    };
};

const archDir = (root: string, arch: string): string => join(root, OUT_DIR, arch);

const manifestPath = (root: string, arch: string, packager: string): string =>
    join(archDir(root, arch), "targets", packager, "nfpm.yaml");

const nfpmArch = (root: string, arch: string, packager: string): string => {
    const contents = readFileSync(manifestPath(root, arch, packager), "utf8");

    return (parse(contents) as NfpmArch).arch;
};

const stagedMachine = (root: string, arch: string): number => {
    const contents = readFileSync(join(archDir(root, arch), STAGED_BINDING));

    return contents.readUInt16LE(OFFSET_MACHINE);
};

const hasArchOutput = (root: string, arch: string): boolean => existsSync(join(archDir(root, arch), "out"));

const archDirNames = (root: string): string[] =>
    readdirSync(join(root, OUT_DIR)).filter((name) => Object.hasOwn(MACHINE_FOR, name));

const archConfig = (architectures: string[]): string =>
    config(`    deploy: {\n${DEPLOY_FIELDS}\n        architectures: ${JSON.stringify(architectures)},\n    },\n`);

const runDeploy = (args: string[], files: Record<string, string | Buffer> = projectFiles()): number | null => {
    const project = createCliProject({ prefix: "gtkx-cli-arch-", config: config(DEPLOY_BLOCK), files, hasStore: true });

    try {
        return runCli(project, ["deploy", "--print-manifests", ...args]).status;
    } finally {
        removeCliProject(project);
    }
};

describe("gtkx deploy --arch", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-arch-",
        config: config(DEPLOY_BLOCK),
        files: { ...projectFiles(), ...addonPackage(FOREIGN_ARCH) },
        args: ["deploy", "--print-manifests", "--target", "deb,rpm", "--arch", `${HOST_ARCH},${FOREIGN_ARCH}`],
    });

    it("writes a manifest tree for every requested architecture", () => {
        expectSuccessfulDeploy(state);
        expect(existsSync(manifestPath(state.project.root, HOST_ARCH, "deb"))).toBe(true);
        expect(existsSync(manifestPath(state.project.root, FOREIGN_ARCH, "rpm"))).toBe(true);
    });

    it("names each package for the architecture it was requested for", () => {
        expectSuccessfulDeploy(state);
        expect(nfpmArch(state.project.root, "x64", "deb")).toBe("amd64");
        expect(nfpmArch(state.project.root, "x64", "rpm")).toBe("x86_64");
        expect(nfpmArch(state.project.root, "arm64", "deb")).toBe("arm64");
        expect(nfpmArch(state.project.root, "arm64", "rpm")).toBe("aarch64");
    });

    it("stages the native addon built for each architecture", () => {
        expectSuccessfulDeploy(state);
        expect(stagedMachine(state.project.root, HOST_ARCH)).toBe(MACHINE_FOR[HOST_ARCH]);
        expect(stagedMachine(state.project.root, FOREIGN_ARCH)).toBe(MACHINE_FOR[FOREIGN_ARCH]);
    });

    it("keeps the artifact directory outside the per-architecture trees", () => {
        expectSuccessfulDeploy(state);
        expect(hasArchOutput(state.project.root, HOST_ARCH)).toBe(false);
        expect(hasArchOutput(state.project.root, FOREIGN_ARCH)).toBe(false);
        expect(archDirNames(state.project.root)).toHaveLength(2);
    });
});

describe("gtkx deploy --arch (defaults)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-arch-host-",
        config: config(DEPLOY_BLOCK),
        files: projectFiles(),
        args: ["deploy", "--print-manifests", "--target", "deb"],
    });

    it("builds for the host architecture when none is requested", () => {
        expectSuccessfulDeploy(state);
        expect(archDirNames(state.project.root)).toEqual([HOST_ARCH]);
    });
});

describe("gtkx deploy --arch (config)", () => {
    const state = deployProbe({
        prefix: "gtkx-cli-arch-config-",
        config: archConfig([HOST_ARCH, FOREIGN_ARCH]),
        files: { ...projectFiles(), ...addonPackage(FOREIGN_ARCH) },
        args: ["deploy", "--print-manifests", "--target", "deb"],
    });

    it("reads the architectures from the deploy config", () => {
        expectSuccessfulDeploy(state);
        expect(existsSync(manifestPath(state.project.root, FOREIGN_ARCH, "deb"))).toBe(true);
    });
});

describe("gtkx deploy --arch (rejections)", () => {
    it("deduplicates a repeated architecture", () => {
        expect(runDeploy(["--target", "deb", "--arch", `${HOST_ARCH},${HOST_ARCH}`])).toBe(0);
    });

    it("refuses an architecture it cannot package for", () => {
        expect(runDeploy(["--target", "deb", "--arch", "riscv64"])).not.toBe(0);
    });

    it("refuses an empty architecture list", () => {
        expect(runDeploy(["--target", "deb", "--arch", ""])).not.toBe(0);
    });

    it("refuses a target that only packages for the host", () => {
        expect(runDeploy(["--target", "flatpak", "--arch", FOREIGN_ARCH])).not.toBe(0);
        expect(runDeploy(["--target", "appimage", "--arch", FOREIGN_ARCH])).not.toBe(0);
    });

    it("refuses a mixed run rather than thinning the matrix", () => {
        expect(runDeploy(["--target", "deb,flatpak", "--arch", `${HOST_ARCH},${FOREIGN_ARCH}`])).not.toBe(0);
    });

    it("refuses a foreign architecture with a host Node.js runtime", () => {
        const body = `    deploy: {\n${DEPLOY_FIELDS}\n        node: { source: "host" },\n    },\n`;
        const project = createCliProject({
            prefix: "gtkx-cli-arch-node-",
            config: config(body),
            files: projectFiles(),
            hasStore: true,
        });

        try {
            expect(runCli(project, ["deploy", "--target", "deb", "--arch", FOREIGN_ARCH]).status).not.toBe(0);
        } finally {
            removeCliProject(project);
        }
    });

    it("refuses a staged addon built for another architecture", () => {
        const files = { ...projectFiles(), ...addonPackage(FOREIGN_ARCH, HOST_ARCH) };
        expect(runDeploy(["--target", "deb", "--arch", FOREIGN_ARCH], files)).not.toBe(0);
    });
});

describe("gtkx deploy --arch (skip build)", () => {
    it("packages an existing build for another architecture", () => {
        const project = createCliProject({
            prefix: "gtkx-cli-arch-skip-",
            config: config(DEPLOY_BLOCK),
            files: { ...projectFiles(), ...addonPackage(FOREIGN_ARCH) },
            hasStore: true,
        });

        try {
            expect(runCli(project, ["build"]).status).toBe(0);
            const args = ["deploy", "--print-manifests", "--skip-build", "--target", "deb", "--arch", FOREIGN_ARCH];
            expect(runCli(project, args).status).toBe(0);
            expect(stagedMachine(project.root, FOREIGN_ARCH)).toBe(MACHINE_FOR[FOREIGN_ARCH]);
        } finally {
            removeCliProject(project);
        }
    });
});
