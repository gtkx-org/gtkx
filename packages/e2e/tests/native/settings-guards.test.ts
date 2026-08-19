import * as Gio from "@gtkx/gi/gio";
import * as Gtk from "@gtkx/gi/gtk";
import { describe, expect, it } from "vitest";

const SCHEMA_ID = "com.gtkx.test.useSetting";
const RELOCATABLE_SCHEMA_ID = "com.gtkx.test.useSetting.profile";

const lookupSchema = (schemaId: string): Gio.SettingsSchema => {
    const source = Gio.SettingsSchemaSource.getDefault();
    const schema = source?.lookup(schemaId, true) ?? null;

    if (schema === null) {
        throw new Error(`Test schema '${schemaId}' is not compiled`);
    }

    return schema;
};

describe("settings guards — happy path", () => {
    it("constructs from a schema id and round-trips key values", () => {
        const settings = Gio.Settings.new(SCHEMA_ID);
        settings.reset("count");
        expect(settings.getInt("count")).toBe(0);
        expect(settings.setInt("count", 7)).toBe(true);
        expect(settings.getInt("count")).toBe(7);
        settings.reset("count");
    });

    it("constructs from constructor props and reads typed values", () => {
        const settings = new Gio.Settings({ schemaId: SCHEMA_ID });
        settings.reset("label");
        expect(settings.getString("label")).toBe("initial");
        expect(settings.isWritable("label")).toBe(true);
        expect(settings.getValue("label").getString()[0]).toBe("initial");
    });

    it("creates actions and binds declared keys to object properties", () => {
        const settings = Gio.Settings.new(SCHEMA_ID);
        settings.reset("enabled");
        const action = settings.createAction("enabled");
        expect(action.getName()).toBe("enabled");
        const toggle = new Gtk.Switch();
        settings.bind("enabled", toggle, "active", Gio.SettingsBindFlags.DEFAULT);
        settings.setBoolean("enabled", true);
        expect(toggle.getActive()).toBe(true);
        Gio.Settings.unbind(toggle, "active");
        settings.reset("enabled");
    });
});

describe("settings guards — edge cases", () => {
    it("instantiates a relocatable schema at explicit paths, isolated per path", () => {
        const first = new Gio.Settings({ schemaId: RELOCATABLE_SCHEMA_ID, path: "/com/gtkx/test/profiles/a/" });
        const second = Gio.Settings.newWithPath(RELOCATABLE_SCHEMA_ID, "/com/gtkx/test/profiles/b/");
        first.setString("title", "first");
        expect(first.getString("title")).toBe("first");
        expect(second.getString("title")).toBe("untitled");
        first.reset("title");
    });

    it("accepts a path equal to the one a non-relocatable schema declares", () => {
        const settings = new Gio.Settings({ schemaId: SCHEMA_ID, path: "/com/gtkx/test/useSetting/" });
        expect(settings.schemaId).toBe(SCHEMA_ID);
    });

    it("constructs from an explicit settings schema, with and without a path", () => {
        const fixed = Gio.Settings.newFull(lookupSchema(SCHEMA_ID), null, null);
        expect(fixed.getBoolean("enabled")).toBe(false);

        const viaProps = new Gio.Settings({
            settingsSchema: lookupSchema(RELOCATABLE_SCHEMA_ID),
            path: "/com/gtkx/test/profiles/c/",
        });

        expect(viaProps.getString("title")).toBe("untitled");
    });

    it("opens declared child settings objects", () => {
        const settings = Gio.Settings.new(SCHEMA_ID);
        const child = settings.getChild("nested");
        expect(child.getInt("depth")).toBe(1);
    });

    it("guards keys per settings object, not per schema id", () => {
        const parent = Gio.Settings.new(SCHEMA_ID);
        const child = parent.getChild("nested");
        expect(parent.getBoolean("enabled")).toBe(false);
        expect(child.getInt("depth")).toBe(1);
        expect(() => child.getBoolean("enabled")).toThrow();
    });
});

describe("settings guards — error paths", () => {
    it("throws when constructing against an unknown schema id", () => {
        expect(() => Gio.Settings.new("com.gtkx.test.doesNotExist")).toThrow();
        expect(() => new Gio.Settings({ schemaId: "com.gtkx.test.doesNotExist" })).toThrow();
        expect(() => Gio.Settings.newWithPath("com.gtkx.test.doesNotExist", "/com/gtkx/test/x/")).toThrow();
    });

    it("throws when constructing without any schema", () => {
        expect(() => new Gio.Settings()).toThrow();
        expect(() => new Gio.Settings({})).toThrow();
    });

    it("throws when a relocatable schema is given no path", () => {
        expect(() => Gio.Settings.new(RELOCATABLE_SCHEMA_ID)).toThrow();
        expect(() => new Gio.Settings({ schemaId: RELOCATABLE_SCHEMA_ID })).toThrow();
        expect(() => Gio.Settings.newFull(lookupSchema(RELOCATABLE_SCHEMA_ID), null, null)).toThrow();
    });

    it("throws when the given path is invalid or contradicts the schema", () => {
        expect(() => new Gio.Settings({ schemaId: RELOCATABLE_SCHEMA_ID, path: "missing-slashes" })).toThrow();
        expect(() => Gio.Settings.newWithPath(SCHEMA_ID, "/somewhere/else/")).toThrow();
        expect(() => Gio.Settings.newFull(lookupSchema(SCHEMA_ID), null, "/somewhere/else/")).toThrow();
    });

    it("throws when a key the schema does not declare is used", () => {
        const settings = Gio.Settings.new(SCHEMA_ID);
        const toggle = new Gtk.Switch();
        expect(() => settings.getBoolean("missing")).toThrow();
        expect(() => settings.setInt("missing", 1)).toThrow();
        expect(() => settings.getValue("missing")).toThrow();
        expect(() => settings.getUserValue("missing")).toThrow();
        expect(() => settings.getDefaultValue("missing")).toThrow();

        expect(() => {
            settings.reset("missing");
        }).toThrow();

        expect(() => settings.isWritable("missing")).toThrow();
        expect(() => settings.createAction("missing")).toThrow();

        expect(() => {
            settings.bind("missing", toggle, "active", Gio.SettingsBindFlags.DEFAULT);
        }).toThrow();

        expect(() => {
            settings.bindWritable("missing", toggle, "active", false);
        }).toThrow();
    });

    it("throws when a child the schema does not declare is opened", () => {
        const settings = Gio.Settings.new(SCHEMA_ID);
        expect(() => settings.getChild("missing")).toThrow();
    });

    it("throws when a schema key object is looked up for an unknown key", () => {
        expect(() => lookupSchema(SCHEMA_ID).getKey("missing")).toThrow();
    });
});
