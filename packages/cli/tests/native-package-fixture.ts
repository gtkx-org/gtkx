import nativeManifest from "@gtkx/native/package.json" with { type: "json" };
import { copyFileSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

type NativeLayout = "source-built" | "installed" | "missing";

const NATIVE_ROOT = fileURLToPath(new URL("../../native", import.meta.url));
const BINARY_NAME = `native.linux-${process.arch}-gnu.node`;
const PACKAGE_NAME = `@gtkx/native-linux-${process.arch}-gnu`;
const NATIVE_ENTRY = `import { alloc, bindField, readField, writeField } from "@gtkx/native";
const field = bindField({ kind: "int32" });
const handle = alloc(4);
writeField(field, handle, 0, 42);
if (readField(field, handle, 0) !== 42) throw new Error("Native field round trip failed");
`;

const installNativePackage = (root: string, layout: NativeLayout): void => {
    const destination = join(root, "node_modules", "@gtkx", "native");
    rmSync(destination);
    mkdirSync(destination, { recursive: true });

    for (const file of ["package.json", ...nativeManifest.files]) {
        copyFileSync(join(NATIVE_ROOT, file), join(destination, file));
    }

    if (layout === "source-built") {
        copyFileSync(join(NATIVE_ROOT, BINARY_NAME), join(destination, BINARY_NAME));
    } else if (layout === "installed") {
        const platform = join(destination, "node_modules", PACKAGE_NAME);
        mkdirSync(platform, { recursive: true });
        writeFileSync(join(platform, "package.json"), JSON.stringify({
            name: PACKAGE_NAME,
            version: nativeManifest.version,
            main: BINARY_NAME,
        }));
        copyFileSync(join(NATIVE_ROOT, BINARY_NAME), join(platform, BINARY_NAME));
    }
};

export { installNativePackage, NATIVE_ENTRY, type NativeLayout };
