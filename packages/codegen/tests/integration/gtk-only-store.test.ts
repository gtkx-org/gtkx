import { toCamelIdentifier } from "@gtkx/utils";
import { mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, describe, expect, it } from "vitest";
import { runCodegen } from "../../src/index.js";
import { constructionGuard } from "../helpers/construction-guard.js";
import { GIR_PATH } from "../helpers/gir-path.js";
import { isolateProject } from "../helpers/isolated-project.js";
import { storeUnit } from "../helpers/store-unit.js";

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
    ["harfbuzz", "hb_face_collect_unicodes"],
    ["harfbuzz", "hb_face_collect_nominal_glyph_mapping"],
    ["harfbuzz", "hb_face_collect_variation_selectors"],
    ["harfbuzz", "hb_face_collect_variation_unicodes"],
    ["harfbuzz", "hb_ot_layout_collect_features"],
    ["harfbuzz", "hb_ot_layout_collect_features_map"],
    ["harfbuzz", "hb_ot_layout_collect_lookups"],
    ["harfbuzz", "hb_ot_layout_get_glyphs_in_class"],
    ["harfbuzz", "hb_ot_layout_lookup_collect_glyphs"],
    ["harfbuzz", "hb_ot_layout_lookup_substitute_closure"],
    ["harfbuzz", "hb_ot_layout_lookups_substitute_closure"],
    ["harfbuzz", "hb_ot_shape_glyphs_closure"],
    ["harfbuzz", "hb_ot_shape_plan_collect_lookups"],
];

const MARSHALABLE: [string, string][] = [
    ["glib", "g_shell_parse_argv"],
    ["glib", "g_base64_decode_inplace"],
    ["glib", "g_filename_from_uri"],
    ["glib", "g_unichar_to_utf8"],
    ["glib", "g_propagate_error"],
    ["gio", "g_settings_backend_flatten_tree"],
    ["gio", "g_tls_password_get_value"],
    ["gobject", "g_type_query"],
    ["gobject", "g_signal_query"],
    ["pango", "pango_layout_get_log_attrs"],
    ["pango", "pango_extents_to_pixels"],
    ["gdk", "gdk_display_map_keyval"],
    ["gtk", "gtk_gesture_stylus_get_backlog"],
];

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
        isolateProject(projectModules);

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

describe("the record classes the emitted store declares", () => {
    const { gi } = storeOptions();

    it("declares abstract the class no caller can construct, and only that one", () => {
        const types = readFileSync(join(gi.storeDir, "glib", "glib.d.ts"), "utf8");
        expect(types).toContain("export declare abstract class KeyFile {");
        expect(types).not.toContain("KeyFileConstructorProps");
        expect(types).toContain("export declare class TimeVal {");
        expect(types).toContain("export interface TimeValConstructorProps {");
    });

    it.each([
        ["GLib.KeyFile", "use GLib.KeyFile.new() instead."],
        ["GLib.Bytes", "use GLib.Bytes.new(data) instead."],
        ["GLib.AsyncQueue", "use GLib.AsyncQueue.new() instead."],
        ["GLib.Uri", "use GLib.Uri.build(flags, scheme, userinfo, host, port, path, query, fragment) instead."],
        ["GLib.MatchInfo", "its instances come from the functions that return them."],
    ])("points %s at the door its own statics open", (qualified, message) => {
        expect(constructionGuard(namespaceSource(gi.storeDir, "glib"), qualified)).toBe(message);
    });

    it("allocates the out buffer for a record whose layout is known but whose class is abstract", () => {
        const source = namespaceSource(gi.storeDir, "gobject");
        const types = readFileSync(join(gi.storeDir, "gobject", "gobject.d.ts"), "utf8");
        expect(types).toContain("export declare abstract class TypeQuery {");
        expect(types).toContain("export declare function typeQuery(type: Type): TypeQuery;");
        expect(source).toContain("wrapHandle(alloc(24), TypeQuery)");
    });

    it("drops the unallocatable out-parameter from a callable that declares it optional", () => {
        const types = readFileSync(join(gi.storeDir, "harfbuzz", "harfbuzz.d.ts"), "utf8");

        expect(types).toContain(
            "export declare function otTagsToScriptAndLanguage(scriptTag: tag_t, languageTag: tag_t): script_t;",
        );

        expect(namespaceSource(gi.storeDir, "harfbuzz")).toContain(
            "return hbOtTagsToScriptAndLanguage(scriptTag, languageTag, undefined);",
        );
    });
});
