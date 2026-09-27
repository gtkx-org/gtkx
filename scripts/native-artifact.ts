import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const nativeArtifactHash = (path: string): string => createHash("sha256").update(readFileSync(path)).digest("hex");

const verifyFile = (directory: string, name: string): string => {
    const path = join(directory, name);
    const checksum = readFileSync(`${path}.sha256`, "utf8").trim();

    if (checksum !== `${nativeArtifactHash(path)}  ${name}`) {
        throw new Error(`Native release artifact checksum mismatch: ${name}`);
    }

    return path;
};

const verifyNativeArtifacts = (directory: string, architecture: string): {
    binary: string;
    javascript: string;
    declarations: string;
} => {
    if (architecture !== "x64" && architecture !== "arm64") {
        throw new Error(`Unsupported release architecture: ${architecture}`);
    }

    const platform = `linux-${architecture}-gnu`;

    return {
        binary: verifyFile(directory, `native.${platform}.node`),
        javascript: verifyFile(directory, `index.${platform}.js`),
        declarations: verifyFile(directory, `index.${platform}.d.ts`),
    };
};

export { nativeArtifactHash, verifyNativeArtifacts };
