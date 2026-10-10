import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { join, resolve } from "node:path";

const hash = createHash("sha256");
const mode = process.argv[2];
const compare = (left: string, right: string): number => left.localeCompare(right, "en");
const add = (value: unknown): void => {
    hash.update(JSON.stringify(value));
    hash.update("\n");
};

const query = (command: string, args: string[]): string => {
    const result = spawnSync(command, args, { encoding: "utf8" });
    add([command, args, result.status, result.stdout]);

    return result.status === 0 ? result.stdout.trim() : "";
};

const addFile = (path: string): void => {
    add(path);
    add(existsSync(path));

    if (existsSync(path)) {
        hash.update(readFileSync(path));
    }
};

const addEnvironment = (variables: string[], prefixes: string[]): void => {
    const names = Object.keys(process.env)
        .filter((name) => variables.includes(name) || prefixes.some((prefix) => name.startsWith(prefix)))
        .toSorted(compare);
    add(names.map((name) => [name, process.env[name]]));
};

const addGirDirectory = (path: string): void => {
    add(path);

    if (!existsSync(path)) {
        return;
    }

    const names = readdirSync(path)
        .filter((entry) => entry.endsWith(".gir"))
        .toSorted(compare);

    for (const name of names) {
        addFile(join(path, name));
    }
};

const addLibrary = (pkg: string, filename: string): void => {
    query("pkg-config", ["--modversion", pkg]);
    const libdir = query("pkg-config", ["--variable=libdir", pkg]);
    const directories = [...(process.env.LD_LIBRARY_PATH ?? "").split(":"), libdir].filter(Boolean);
    const path = directories.map((directory) => join(directory, filename)).find((entry) => existsSync(entry));
    add([pkg, filename, path]);

    if (path !== undefined) {
        addFile(path);
    }
};

const addGlib = (): void => {
    addLibrary("glib-2.0", "libglib-2.0.so.0");
    addLibrary("gobject-2.0", "libgobject-2.0.so.0");
    addLibrary("gio-2.0", "libgio-2.0.so.0");
};

const addRuntime = (): void => {
    addEnvironment(["GTKX_GIR_PATH", "GI_TYPELIB_PATH", "LD_LIBRARY_PATH", "PKG_CONFIG"], ["PKG_CONFIG_"]);
    addGlib();
    addLibrary("cairo", "libcairo.so.2");
    addLibrary("pango", "libpango-1.0.so.0");
    addLibrary("pangocairo", "libpangocairo-1.0.so.0");
    addLibrary("gdk-pixbuf-2.0", "libgdk_pixbuf-2.0.so.0");
    addLibrary("gtk4", "libgtk-4.so.1");
    addLibrary("libadwaita-1", "libadwaita-1.so.0");
    addLibrary("gtksourceview-5", "libgtksourceview-5.so.0");
    addLibrary("webkitgtk-6.0", "libwebkitgtk-6.0.so.4");
    const pkgConfigGirPath = query("pkg-config", ["--variable=girdir", "gobject-introspection-1.0"]);
    const paths = [...(process.env.GTKX_GIR_PATH ?? "").split(":"), "/usr/share/gir-1.0", pkgConfigGirPath];

    const directories = new Set(paths.filter(Boolean).map((entry) => resolve(entry)));

    for (const path of directories) {
        addGirDirectory(path);
    }
};

const addNative = (): void => {
    addEnvironment(
        [
            "CARGO_ENCODED_RUSTFLAGS",
            "CC",
            "CXX",
            "CFLAGS",
            "CXXFLAGS",
            "CPPFLAGS",
            "AR",
            "LD",
            "LDFLAGS",
            "PKG_CONFIG",
            "LIBRARY_PATH",
            "LD_LIBRARY_PATH",
            "CPATH",
            "C_INCLUDE_PATH",
            "CPLUS_INCLUDE_PATH",
        ],
        [
            "RUST",
            "CARGO_BUILD_",
            "CARGO_TARGET_",
            "CARGO_PROFILE_",
            "CC_",
            "CXX_",
            "CFLAGS_",
            "CXXFLAGS_",
            "AR_",
            "PKG_CONFIG_",
            "HOST_",
            "TARGET_",
            "LIBFFI_",
            "GLIB_",
            "GOBJECT_",
            "GIO_",
        ],
    );
    query(process.env.RUSTC ?? "rustc", ["-vV"]);
    query("cargo", ["--version"]);

    const commands = new Set(
        ["cc", "c++", "ar", "ld", process.env.CC, process.env.CXX].filter(
            (value): value is string => value !== undefined,
        ),
    );

    for (const command of commands) {
        query(command, ["--version"]);
    }

    addGlib();
    query("pkg-config", ["--modversion", "libffi"]);
    query("pkg-config", ["--cflags", "--libs", "glib-2.0", "gobject-2.0", "gio-2.0"]);

    const directories = [
        join(homedir(), ".cargo"),
        process.env.CARGO_HOME,
        ".cargo",
        "packages/.cargo",
        "packages/native/.cargo",
    ].filter((value): value is string => value !== undefined);

    for (const directory of directories) {
        addFile(join(directory, "config"));
        addFile(join(directory, "config.toml"));
    }

    const suffix = `linux-${process.arch}-gnu`;
    const names = [`native.${suffix}.node`, `index.${suffix}.js`, `index.${suffix}.d.ts`];

    for (const name of names) {
        const artifact = join("packages/native/artifacts", name);
        addFile(artifact);
        addFile(`${artifact}.sha256`);
    }
};

add([process.versions.node, process.platform, process.arch]);
addFile("/etc/os-release");
query("getconf", ["GNU_LIBC_VERSION"]);

if (mode === "runtime") {
    addRuntime();
} else if (mode === "native") {
    addNative();
} else {
    throw new Error("Expected a runtime or native environment");
}

process.stdout.write(`${hash.digest("hex")}\n`);
