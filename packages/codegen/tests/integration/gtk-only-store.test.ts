import { toCamelIdentifier } from "@gtkx/utils";
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, symlinkSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterAll, describe, expect, it } from "vitest";
import { runCodegen } from "../../src/index.js";
import { storeUnit } from "../helpers/store-unit.js";

const GIR_PATH = ["/usr/share/gir-1.0"];
const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..", "..");
const REACT_PACKAGE = join(REPO_ROOT, "packages", "react");

const PEER_PACKAGES: [string, string][] = [
    ["@gtkx/runtime", join(REPO_ROOT, "packages", "runtime")],
    ["react", join(REPO_ROOT, "node_modules", "react")],
    ["@types/react", join(REPO_ROOT, "node_modules", "@types", "react")],
];

const workDir = mkdtempSync(join(tmpdir(), "gtkx-gtk-only-"));
const projectModules = join(workDir, "node_modules");

const UNMARSHALABLE: [string, string][] = [
    ["glib", "g_option_context_parse"],
    ["glib", "g_option_context_parse_strv"],
    ["glib", "g_prefix_error_literal"],
    ["glib", "g_base64_encode_step"],
    ["glib", "g_base64_encode_close"],
    ["gobject", "g_enum_complete_type_info"],
    ["gobject", "g_flags_complete_type_info"],
    ["graphene", "graphene_box_get_vertices"],
    ["graphene", "graphene_matrix_to_float"],
    ["gdk", "gdk_texture_downloader_download_bytes_with_planes"],
    ["pango", "pango_scan_int"],
    ["pango", "pango_glyph_item_get_logical_widths"],
    ["pango", "pango_tab_array_get_tabs"],
    ["harfbuzz", "hb_tag_to_string"],
    ["harfbuzz", "hb_buffer_serialize_glyphs"],
];

const MARSHALABLE: [string, string][] = [
    ["glib", "g_shell_parse_argv"],
    ["glib", "g_base64_decode_inplace"],
    ["glib", "g_filename_from_uri"],
    ["glib", "g_unichar_to_utf8"],
    ["glib", "g_propagate_error"],
    ["gio", "g_settings_backend_flatten_tree"],
    ["gio", "g_tls_password_get_value"],
    ["pango", "pango_layout_get_log_attrs"],
    ["pango", "pango_extents_to_pixels"],
    ["gdk", "gdk_display_map_keyval"],
    ["gtk", "gtk_gesture_stylus_get_backlog"],
];

const isolateProject = (): void => {
    const target = join(projectModules, "@gtkx", "react");
    mkdirSync(dirname(target), { recursive: true });

    cpSync(REACT_PACKAGE, target, {
        recursive: true,
        filter: (source) => !source.split(/[/\\]/).includes("node_modules"),
    });

    symlinkSync(join(REACT_PACKAGE, "node_modules"), join(target, "node_modules"), "dir");

    for (const [name, source] of PEER_PACKAGES) {
        const link = join(projectModules, name);
        mkdirSync(dirname(link), { recursive: true });
        symlinkSync(source, link, "dir");
    }
};

const storeOptions = () => ({
    gi: storeUnit(projectModules, "gi"),
    jsx: storeUnit(projectModules, "jsx"),
});

const walkEmittedFiles = (directory: string, collected: string[]): void => {
    for (const entry of readdirSync(directory)) {
        const path = join(directory, entry);

        if (entry === "node_modules") {
            continue;
        }

        if (statSync(path).isDirectory()) {
            walkEmittedFiles(path, collected);
            continue;
        }

        collected.push(path);
    }
};

const emittedFiles = (root: string): string[] => {
    const collected: string[] = [];
    walkEmittedFiles(root, collected);

    return collected;
};

const descriptorFor = (source: string, symbol: string): string => {
    const start = source.indexOf(`t.fn("libgtk-4.so.1", "${symbol}"`);

    if (start === -1) {
        throw new Error(`No binding emitted for ${symbol}`);
    }

    return source.slice(start, source.indexOf("});", start));
};

const namespaceSource = (storeDir: string, namespaceDir: string): string =>
    readFileSync(join(storeDir, namespaceDir, `${namespaceDir}.js`), "utf8");

const hasCallableMember = (source: string, cIdentifier: string): boolean => {
    const identifier = toCamelIdentifier(cIdentifier);

    return source.split(new RegExp(String.raw`\b${identifier}\b`)).length - 1 > 1;
};

afterAll(() => {
    rmSync(workDir, { recursive: true, force: true });
});

describe("a project that declares Gtk-4.0 without Adw-1", () => {
    const { gi, jsx } = storeOptions();

    it("writes and type-checks the whole store", async () => {
        isolateProject();

        const result = await runCodegen({
            libraries: ["Gtk-4.0"],
            girPath: GIR_PATH,
            gi,
            jsx,
            isForced: true,
        });

        expect(result.isRegenerated).toBe(true);
        expect(result.namespaces).toBeGreaterThan(0);
        expect(result.intrinsicElements).toBeGreaterThan(0);
    });

    it("generates no adw namespace in either store", () => {
        expect(readdirSync(gi.storeDir)).not.toContain("adw");
        expect(readdirSync(jsx.storeDir)).not.toContain("adw");
    });

    it("emits no reference to the Adwaita-only react entry point", () => {
        const files = [...emittedFiles(gi.storeDir), ...emittedFiles(jsx.storeDir)];
        expect(files.length).toBeGreaterThan(0);
        const offenders = files.filter((file) => readFileSync(file, "utf8").includes("@gtkx/react/adw"));
        expect(offenders).toEqual([]);
    });

    it("marshals a derived fundamental return through the ref pair it inherits", () => {
        const source = readFileSync(join(gi.storeDir, "gtk", "gtk.js"), "utf8");
        const derived = descriptorFor(source, "gtk_property_expression_new");
        expect(derived).toContain("returns: t.fundamental(");
        expect(derived).toContain("gtk_expression_unref");
        expect(derived).not.toContain("returns: t.object");
        const root = descriptorFor(source, "gtk_bool_filter_get_expression");
        expect(root).toContain("returns: t.fundamental(");
    });

    it.each(UNMARSHALABLE)("emits no callable member for %s.%s", (namespaceDir, cIdentifier) => {
        expect(hasCallableMember(namespaceSource(gi.storeDir, namespaceDir), cIdentifier)).toBe(false);
    });

    it.each(MARSHALABLE)("keeps the callable member for %s.%s", (namespaceDir, cIdentifier) => {
        expect(hasCallableMember(namespaceSource(gi.storeDir, namespaceDir), cIdentifier)).toBe(true);
    });

    it("keeps a throwing callable and the canThrow flag on its descriptor", () => {
        const source = namespaceSource(gi.storeDir, "glib");
        const start = source.indexOf('"g_key_file_load_from_file"');
        expect(start).toBeGreaterThan(-1);
        expect(source.slice(start, source.indexOf("});", start))).toContain("canThrow: true");
        expect(hasCallableMember(source, "g_key_file_load_from_file")).toBe(true);
    });
});
