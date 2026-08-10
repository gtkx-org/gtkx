import { join } from "node:path";
import { cacheDir, downloadFile } from "../download.js";

type AppimageTooling = {
    tool: string;
    runtime: string;
};

const APPIMAGETOOL_VERSION = "1.9.1";
const RUNTIME_VERSION = "20251108";
const APPIMAGETOOL_URL = `https://github.com/AppImage/appimagetool/releases/download/${APPIMAGETOOL_VERSION}`;
const RUNTIME_URL = `https://github.com/AppImage/type2-runtime/releases/download/${RUNTIME_VERSION}`;
const EXECUTABLE_MODE = 0o755;

const APPIMAGETOOL_DIGESTS: Record<string, string> = {
    aarch64: "f0837e7448a0c1e4e650a93bb3e85802546e60654ef287576f46c71c126a9158",
    x86_64: "ed4ce84f0d9caff66f50bcca6ff6f35aae54ce8135408b3fa33abfc3cb384eb0",
};

const RUNTIME_DIGESTS: Record<string, string> = {
    aarch64: "00cbdfcf917cc6c0ff6d3347d59e0ca1f7f45a6df1a428a0d6d8a78664d87444",
    x86_64: "2fca8b443c92510f1483a883f60061ad09b46b978b2631c807cd873a47ec260d",
};

const digestFor = (digests: Record<string, string>, arch: string, subject: string): string => {
    const digest = digests[arch];

    if (digest === undefined) {
        throw new Error(`${subject} has no pinned build for ${arch}`);
    }

    return digest;
};

const resolveAppimageTooling = async (arch: string): Promise<AppimageTooling> => {
    const dir = cacheDir(["appimage", `${APPIMAGETOOL_VERSION}-${RUNTIME_VERSION}`]);

    const tool = await downloadFile({
        url: `${APPIMAGETOOL_URL}/appimagetool-${arch}.AppImage`,
        dest: join(dir, `appimagetool-${arch}`),
        label: `appimagetool ${APPIMAGETOOL_VERSION}`,
        sha256: digestFor(APPIMAGETOOL_DIGESTS, arch, "appimagetool"),
        mode: EXECUTABLE_MODE,
    });

    const runtime = await downloadFile({
        url: `${RUNTIME_URL}/runtime-${arch}`,
        dest: join(dir, `runtime-${arch}`),
        label: `the AppImage runtime ${RUNTIME_VERSION}`,
        sha256: digestFor(RUNTIME_DIGESTS, arch, "the AppImage runtime"),
        mode: EXECUTABLE_MODE,
    });

    return { tool, runtime };
};

export { resolveAppimageTooling };
