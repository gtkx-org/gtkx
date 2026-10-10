import { execFileSync } from "node:child_process";
import { copyFileSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { verifyNativeArtifacts } from "./verify-artifacts.ts";

const args = process.argv.slice(2);

if (args[0] === "--from-artifacts") {
    if (args.length > 1) {
        throw new Error("Staged native release artifacts cannot accept build arguments");
    }

    const artifacts = verifyNativeArtifacts(join(process.cwd(), "artifacts"), process.arch);
    copyFileSync(artifacts.binary, join(process.cwd(), `native.linux-${process.arch}-gnu.node`));
    copyFileSync(artifacts.javascript, join(process.cwd(), "index.js"));
    copyFileSync(artifacts.declarations, join(process.cwd(), "index.d.ts"));
} else {
    const require = createRequire(join(process.cwd(), "package.json"));
    const cli = join(dirname(require.resolve("@napi-rs/cli/package.json")), "dist", "cli.js");
    const separator = args.indexOf("--");
    const napiArgs = separator === -1 ? args : args.slice(0, separator);
    const cargoArgs = separator === -1 ? [] : args.slice(separator + 1);
    execFileSync(
        process.execPath,
        [
            cli,
            "build",
            "--platform",
            "--release",
            "--esm",
            "--no-dts-cache",
            "--no-const-enum",
            ...napiArgs,
            "--",
            "--locked",
            ...cargoArgs,
        ],
        { stdio: "inherit" },
    );
}
