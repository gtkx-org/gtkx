import { describe, expect, it } from "vitest";
import { RawGirParser as GirParser } from "../../src/internal/parser.js";

const createMinimalGir = (namespaceContent: string, name = "Test", version = "1.0") => `<?xml version="1.0"?>
<repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0"
    xmlns:c="http://www.gtk.org/introspection/c/1.0"
    xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
    <namespace name="${name}" version="${version}" shared-library="libtest.so"
        c:identifier-prefixes="Test" c:symbol-prefixes="test">
        ${namespaceContent}
    </namespace>
</repository>`;

describe("GirParser", () => {
    it("parses namespace metadata", () => {
        const parser = new GirParser();
        const result = parser.parse(createMinimalGir(""));

        expect(result.name).toBe("Test");
        expect(result.version).toBe("1.0");
        expect(result.sharedLibrary).toBe("libtest.so");
        expect(result.cPrefix).toBe("Test");
    });

    it("handles custom namespace name and version", () => {
        const parser = new GirParser();
        const result = parser.parse(createMinimalGir("", "Gtk", "4.0"));

        expect(result.name).toBe("Gtk");
        expect(result.version).toBe("4.0");
    });

    it("initializes empty arrays for all type collections", () => {
        const parser = new GirParser();
        const result = parser.parse(createMinimalGir(""));

        expect(result.classes).toEqual([]);
        expect(result.interfaces).toEqual([]);
        expect(result.functions).toEqual([]);
        expect(result.enumerations).toEqual([]);
        expect(result.bitfields).toEqual([]);
        expect(result.records).toEqual([]);
        expect(result.callbacks).toEqual([]);
        expect(result.constants).toEqual([]);
    });

    describe("class parsing", () => {
        it("parses basic class", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget" parent="GObject.Object" abstract="1"
                    glib:type-name="TestWidget" glib:get-type="test_widget_get_type"
                    c:symbol-prefix="widget">
                    <doc xml:space="preserve">A test widget</doc>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes).toHaveLength(1);
            expect(result.classes[0].name).toBe("Widget");
            expect(result.classes[0].cType).toBe("TestWidget");
            expect(result.classes[0].parent).toBe("GObject.Object");
            expect(result.classes[0].abstract).toBe(true);
            expect(result.classes[0].glibTypeName).toBe("TestWidget");
            expect(result.classes[0].glibGetType).toBe("test_widget_get_type");
            expect(result.classes[0].cSymbolPrefix).toBe("widget");
            expect(result.classes[0].doc).toBe("A test widget");
        });

        it("parses class implementing interfaces", () => {
            const gir = createMinimalGir(`
                <class name="Button" c:type="TestButton">
                    <implements name="Buildable"/>
                    <implements name="Actionable"/>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].implements).toEqual(["Buildable", "Actionable"]);
        });

        it("parses class with single implements", () => {
            const gir = createMinimalGir(`
                <class name="Button" c:type="TestButton">
                    <implements name="Buildable"/>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].implements).toEqual(["Buildable"]);
        });

        it("parses class methods", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <method name="show" c:identifier="test_widget_show">
                        <doc xml:space="preserve">Shows the widget</doc>
                        <return-value transfer-ownership="none">
                            <type name="none"/>
                        </return-value>
                    </method>
                    <method name="get_name" c:identifier="test_widget_get_name">
                        <return-value transfer-ownership="none">
                            <type name="utf8"/>
                        </return-value>
                    </method>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].methods).toHaveLength(2);
            expect(result.classes[0].methods[0].name).toBe("show");
            expect(result.classes[0].methods[0].cIdentifier).toBe("test_widget_show");
            expect(result.classes[0].methods[0].doc).toBe("Shows the widget");
            expect(result.classes[0].methods[1].name).toBe("get_name");
        });

        it("filters out non-introspectable methods", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <method name="show" c:identifier="test_widget_show" introspectable="0">
                        <return-value><type name="none"/></return-value>
                    </method>
                    <method name="hide" c:identifier="test_widget_hide">
                        <return-value><type name="none"/></return-value>
                    </method>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].methods).toHaveLength(1);
            expect(result.classes[0].methods[0].name).toBe("hide");
        });

        it("parses method with throws attribute", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <method name="load_file" c:identifier="test_widget_load_file" throws="1">
                        <return-value><type name="gboolean"/></return-value>
                    </method>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].methods[0].throws).toBe(true);
        });

        it("parses class constructors", () => {
            const gir = createMinimalGir(`
                <class name="Button" c:type="TestButton">
                    <constructor name="new" c:identifier="test_button_new">
                        <return-value transfer-ownership="none">
                            <type name="Button"/>
                        </return-value>
                    </constructor>
                    <constructor name="new_with_label" c:identifier="test_button_new_with_label">
                        <return-value transfer-ownership="none">
                            <type name="Button"/>
                        </return-value>
                        <parameters>
                            <parameter name="label">
                                <type name="utf8"/>
                            </parameter>
                        </parameters>
                    </constructor>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].constructors).toHaveLength(2);
            expect(result.classes[0].constructors[0].name).toBe("new");
            expect(result.classes[0].constructors[1].name).toBe("new_with_label");
            expect(result.classes[0].constructors[1].parameters).toHaveLength(1);
        });

        it("parses class static functions", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <function name="get_default_direction" c:identifier="test_widget_get_default_direction">
                        <return-value><type name="TextDirection"/></return-value>
                    </function>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].functions).toHaveLength(1);
            expect(result.classes[0].functions[0].name).toBe("get_default_direction");
        });

        it("parses class properties", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <property name="visible" readable="1" writable="1" construct-only="0"
                        default-value="TRUE" getter="get_visible" setter="set_visible">
                        <doc xml:space="preserve">Widget visibility</doc>
                        <type name="gboolean"/>
                    </property>
                    <property name="name" readable="1" writable="0">
                        <type name="utf8"/>
                    </property>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].properties).toHaveLength(2);
            expect(result.classes[0].properties[0].name).toBe("visible");
            expect(result.classes[0].properties[0].readable).toBe(true);
            expect(result.classes[0].properties[0].writable).toBe(true);
            expect(result.classes[0].properties[0].constructOnly).toBe(false);
            expect(result.classes[0].properties[0].hasDefault).toBe(true);
            expect(result.classes[0].properties[0].getter).toBe("get_visible");
            expect(result.classes[0].properties[0].setter).toBe("set_visible");
            expect(result.classes[0].properties[0].doc).toBe("Widget visibility");
            expect(result.classes[0].properties[1].readable).toBe(true);
            expect(result.classes[0].properties[1].writable).toBe(false);
        });

        it("parses class signals", () => {
            const gir = createMinimalGir(`
                <class name="Button" c:type="TestButton">
                    <glib:signal name="clicked" when="first">
                        <doc xml:space="preserve">Emitted when clicked</doc>
                        <return-value><type name="none"/></return-value>
                    </glib:signal>
                    <glib:signal name="toggled" when="last">
                        <return-value><type name="none"/></return-value>
                        <parameters>
                            <parameter name="active">
                                <type name="gboolean"/>
                            </parameter>
                        </parameters>
                    </glib:signal>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].signals).toHaveLength(2);
            expect(result.classes[0].signals[0].name).toBe("clicked");
            expect(result.classes[0].signals[0].when).toBe("first");
            expect(result.classes[0].signals[0].doc).toBe("Emitted when clicked");
            expect(result.classes[0].signals[1].name).toBe("toggled");
            expect(result.classes[0].signals[1].when).toBe("last");
            expect(result.classes[0].signals[1].parameters).toHaveLength(1);
        });
    });

    describe("interface parsing", () => {
        it("parses interface", () => {
            const gir = createMinimalGir(`
                <interface name="Buildable" c:type="TestBuildable" glib:type-name="TestBuildable">
                    <doc xml:space="preserve">Buildable interface</doc>
                    <method name="get_name" c:identifier="test_buildable_get_name">
                        <return-value><type name="utf8"/></return-value>
                    </method>
                    <property name="name" readable="1" writable="1">
                        <type name="utf8"/>
                    </property>
                    <glib:signal name="notify" when="last">
                        <return-value><type name="none"/></return-value>
                    </glib:signal>
                </interface>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.interfaces).toHaveLength(1);
            expect(result.interfaces[0].name).toBe("Buildable");
            expect(result.interfaces[0].cType).toBe("TestBuildable");
            expect(result.interfaces[0].glibTypeName).toBe("TestBuildable");
            expect(result.interfaces[0].doc).toBe("Buildable interface");
            expect(result.interfaces[0].methods).toHaveLength(1);
            expect(result.interfaces[0].properties).toHaveLength(1);
            expect(result.interfaces[0].signals).toHaveLength(1);
        });
    });

    describe("function parsing", () => {
        it("parses standalone functions", () => {
            const gir = createMinimalGir(`
                <function name="init" c:identifier="test_init">
                    <doc xml:space="preserve">Initializes the library</doc>
                    <return-value><type name="none"/></return-value>
                </function>
                <function name="get_version" c:identifier="test_get_version">
                    <return-value><type name="utf8"/></return-value>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions).toHaveLength(2);
            expect(result.functions[0].name).toBe("init");
            expect(result.functions[0].cIdentifier).toBe("test_init");
            expect(result.functions[0].doc).toBe("Initializes the library");
            expect(result.functions[1].name).toBe("get_version");
        });

        it("parses function with parameters", () => {
            const gir = createMinimalGir(`
                <function name="add" c:identifier="test_add">
                    <return-value><type name="gint"/></return-value>
                    <parameters>
                        <parameter name="a"><type name="gint"/></parameter>
                        <parameter name="b"><type name="gint"/></parameter>
                    </parameters>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].parameters).toHaveLength(2);
            expect(result.functions[0].parameters[0].name).toBe("a");
            expect(result.functions[0].parameters[1].name).toBe("b");
        });
    });

    describe("enumeration parsing", () => {
        it("parses enumeration", () => {
            const gir = createMinimalGir(`
                <enumeration name="TextDirection" c:type="TestTextDirection">
                    <doc xml:space="preserve">Text direction</doc>
                    <member name="ltr" value="0" c:identifier="TEST_TEXT_DIRECTION_LTR">
                        <doc xml:space="preserve">Left to right</doc>
                    </member>
                    <member name="rtl" value="1" c:identifier="TEST_TEXT_DIRECTION_RTL"/>
                    <member name="none" value="2" c:identifier="TEST_TEXT_DIRECTION_NONE"/>
                </enumeration>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.enumerations).toHaveLength(1);
            expect(result.enumerations[0].name).toBe("TextDirection");
            expect(result.enumerations[0].cType).toBe("TestTextDirection");
            expect(result.enumerations[0].doc).toBe("Text direction");
            expect(result.enumerations[0].members).toHaveLength(3);
            expect(result.enumerations[0].members[0].name).toBe("ltr");
            expect(result.enumerations[0].members[0].value).toBe("0");
            expect(result.enumerations[0].members[0].cIdentifier).toBe("TEST_TEXT_DIRECTION_LTR");
            expect(result.enumerations[0].members[0].doc).toBe("Left to right");
        });

        it("parses bitfield", () => {
            const gir = createMinimalGir(`
                <bitfield name="StateFlags" c:type="TestStateFlags">
                    <member name="normal" value="0" c:identifier="TEST_STATE_FLAG_NORMAL"/>
                    <member name="active" value="1" c:identifier="TEST_STATE_FLAG_ACTIVE"/>
                    <member name="focused" value="2" c:identifier="TEST_STATE_FLAG_FOCUSED"/>
                </bitfield>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.bitfields).toHaveLength(1);
            expect(result.bitfields[0].name).toBe("StateFlags");
            expect(result.bitfields[0].members).toHaveLength(3);
        });
    });

    describe("record parsing", () => {
        it("parses record", () => {
            const gir = createMinimalGir(`
                <record name="Rectangle" c:type="TestRectangle"
                    glib:type-name="TestRectangle" glib:get-type="test_rectangle_get_type">
                    <doc xml:space="preserve">A rectangle</doc>
                    <field name="x" writable="1"><type name="gint"/></field>
                    <field name="y" writable="1"><type name="gint"/></field>
                    <field name="width" writable="1"><type name="gint"/></field>
                    <field name="height" writable="1"><type name="gint"/></field>
                </record>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.records).toHaveLength(1);
            expect(result.records[0].name).toBe("Rectangle");
            expect(result.records[0].cType).toBe("TestRectangle");
            expect(result.records[0].glibTypeName).toBe("TestRectangle");
            expect(result.records[0].glibGetType).toBe("test_rectangle_get_type");
            expect(result.records[0].doc).toBe("A rectangle");
            expect(result.records[0].fields).toHaveLength(4);
            expect(result.records[0].fields[0].name).toBe("x");
            expect(result.records[0].fields[0].writable).toBe(true);
        });

        it("parses opaque and disguised records", () => {
            const gir = createMinimalGir(`
                <record name="Private" c:type="TestPrivate" opaque="1"/>
                <record name="Internal" c:type="TestInternal" disguised="1"/>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.records[0].opaque).toBe(true);
            expect(result.records[1].disguised).toBe(true);
        });

        it("parses record with methods and constructors", () => {
            const gir = createMinimalGir(`
                <record name="Rectangle" c:type="TestRectangle" glib:type-name="TestRectangle">
                    <constructor name="new" c:identifier="test_rectangle_new">
                        <return-value><type name="Rectangle"/></return-value>
                    </constructor>
                    <method name="union" c:identifier="test_rectangle_union">
                        <return-value><type name="none"/></return-value>
                        <parameters>
                            <parameter name="src2"><type name="Rectangle"/></parameter>
                            <parameter name="dest" direction="out"><type name="Rectangle"/></parameter>
                        </parameters>
                    </method>
                    <function name="zero" c:identifier="test_rectangle_zero">
                        <return-value><type name="Rectangle"/></return-value>
                    </function>
                </record>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.records[0].constructors).toHaveLength(1);
            expect(result.records[0].methods).toHaveLength(1);
            expect(result.records[0].functions).toHaveLength(1);
        });

        it("filters out callback fields", () => {
            const gir = createMinimalGir(`
                <record name="ClassStruct" c:type="TestClassStruct">
                    <field name="parent"><type name="GObject.ObjectClass"/></field>
                    <field name="do_something">
                        <callback name="do_something">
                            <return-value><type name="none"/></return-value>
                        </callback>
                    </field>
                </record>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.records[0].fields).toHaveLength(1);
            expect(result.records[0].fields[0].name).toBe("parent");
        });
    });

    describe("callback parsing", () => {
        it("parses callback", () => {
            const gir = createMinimalGir(`
                <callback name="Callback" c:type="TestCallback">
                    <doc xml:space="preserve">A callback function</doc>
                    <return-value><type name="gboolean"/></return-value>
                    <parameters>
                        <parameter name="data"><type name="gpointer"/></parameter>
                    </parameters>
                </callback>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.callbacks).toHaveLength(1);
            expect(result.callbacks[0].name).toBe("Callback");
            expect(result.callbacks[0].cType).toBe("TestCallback");
            expect(result.callbacks[0].doc).toBe("A callback function");
            expect(result.callbacks[0].returnType.name).toBe("gboolean");
            expect(result.callbacks[0].parameters).toHaveLength(1);
        });

        it("filters out non-introspectable callbacks", () => {
            const gir = createMinimalGir(`
                <callback name="InternalCallback" c:type="TestInternalCallback" introspectable="0">
                    <return-value><type name="none"/></return-value>
                </callback>
                <callback name="PublicCallback" c:type="TestPublicCallback">
                    <return-value><type name="none"/></return-value>
                </callback>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.callbacks).toHaveLength(1);
            expect(result.callbacks[0].name).toBe("PublicCallback");
        });
    });

    describe("constant parsing", () => {
        it("parses constant", () => {
            const gir = createMinimalGir(`
                <constant name="VERSION_MAJOR" value="4" c:type="TEST_VERSION_MAJOR">
                    <doc xml:space="preserve">Major version</doc>
                    <type name="gint"/>
                </constant>
                <constant name="VERSION_STRING" value="4.0.0" c:type="TEST_VERSION_STRING">
                    <type name="utf8"/>
                </constant>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.constants).toHaveLength(2);
            expect(result.constants[0].name).toBe("VERSION_MAJOR");
            expect(result.constants[0].value).toBe("4");
            expect(result.constants[0].cType).toBe("TEST_VERSION_MAJOR");
            expect(result.constants[0].doc).toBe("Major version");
            expect(result.constants[1].name).toBe("VERSION_STRING");
            expect(result.constants[1].value).toBe("4.0.0");
        });
    });

    describe("parameter parsing", () => {
        it("parses parameter direction", () => {
            const gir = createMinimalGir(`
                <function name="get_size" c:identifier="test_get_size">
                    <return-value><type name="none"/></return-value>
                    <parameters>
                        <parameter name="width" direction="out"><type name="gint"/></parameter>
                        <parameter name="height" direction="out"><type name="gint"/></parameter>
                    </parameters>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].parameters[0].direction).toBe("out");
            expect(result.functions[0].parameters[1].direction).toBe("out");
        });

        it("parses nullable and optional parameters", () => {
            const gir = createMinimalGir(`
                <function name="func" c:identifier="test_func">
                    <return-value><type name="none"/></return-value>
                    <parameters>
                        <parameter name="nullable_param" nullable="1"><type name="utf8"/></parameter>
                        <parameter name="optional_param" allow-none="1"><type name="utf8"/></parameter>
                    </parameters>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].parameters[0].nullable).toBe(true);
            expect(result.functions[0].parameters[1].optional).toBe(true);
        });

        it("parses callback parameter attributes", () => {
            const gir = createMinimalGir(`
                <function name="foreach" c:identifier="test_foreach">
                    <return-value><type name="none"/></return-value>
                    <parameters>
                        <parameter name="callback" scope="call" closure="1" destroy="2">
                            <type name="Callback"/>
                        </parameter>
                        <parameter name="user_data"><type name="gpointer"/></parameter>
                        <parameter name="destroy_notify"><type name="GLib.DestroyNotify"/></parameter>
                    </parameters>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].parameters[0].scope).toBe("call");
            expect(result.functions[0].parameters[0].closure).toBe(1);
            expect(result.functions[0].parameters[0].destroy).toBe(2);
        });

        it("parses caller-allocates parameter", () => {
            const gir = createMinimalGir(`
                <function name="get_rect" c:identifier="test_get_rect">
                    <return-value><type name="none"/></return-value>
                    <parameters>
                        <parameter name="rect" direction="out" caller-allocates="1">
                            <type name="Rectangle"/>
                        </parameter>
                    </parameters>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].parameters[0].callerAllocates).toBe(true);
        });

        it("parses transfer-ownership on parameters", () => {
            const gir = createMinimalGir(`
                <function name="set_data" c:identifier="test_set_data">
                    <return-value><type name="none"/></return-value>
                    <parameters>
                        <parameter name="data" transfer-ownership="full"><type name="utf8"/></parameter>
                    </parameters>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].parameters[0].transferOwnership).toBe("full");
        });
    });

    describe("type parsing", () => {
        it("parses array type with element type", () => {
            const gir = createMinimalGir(`
                <function name="get_items" c:identifier="test_get_items">
                    <return-value>
                        <array>
                            <type name="utf8"/>
                        </array>
                    </return-value>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].returnType.isArray).toBe(true);
            expect(result.functions[0].returnType.elementType?.name).toBe("utf8");
        });

        it("parses GLib.List as array", () => {
            const gir = createMinimalGir(`
                <function name="get_children" c:identifier="test_get_children">
                    <return-value>
                        <type name="GLib.List" c:type="GList*">
                            <type name="Widget"/>
                        </type>
                    </return-value>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].returnType.isArray).toBe(true);
            expect(result.functions[0].returnType.elementType?.name).toBe("Widget");
        });

        it("parses GLib.SList as array", () => {
            const gir = createMinimalGir(`
                <function name="get_items" c:identifier="test_get_items">
                    <return-value>
                        <type name="GLib.SList" c:type="GSList*">
                            <type name="utf8"/>
                        </type>
                    </return-value>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].returnType.isArray).toBe(true);
            expect(result.functions[0].returnType.elementType?.name).toBe("utf8");
        });

        it("parses return type transfer ownership", () => {
            const gir = createMinimalGir(`
                <function name="get_string" c:identifier="test_get_string">
                    <return-value transfer-ownership="full">
                        <type name="utf8"/>
                    </return-value>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].returnType.transferOwnership).toBe("full");
        });

        it("parses nullable return type", () => {
            const gir = createMinimalGir(`
                <function name="find" c:identifier="test_find">
                    <return-value nullable="1">
                        <type name="Widget"/>
                    </return-value>
                </function>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.functions[0].returnType.nullable).toBe(true);
        });
    });

    describe("error handling", () => {
        it("throws on invalid XML without namespace", () => {
            const parser = new GirParser();
            const invalidGir = `<?xml version="1.0"?><repository version="1.2"></repository>`;

            expect(() => parser.parse(invalidGir)).toThrow(
                "Failed to parse GIR file: missing repository or namespace element",
            );
        });

        it("throws on completely invalid XML", () => {
            const parser = new GirParser();

            expect(() => parser.parse("not xml")).toThrow();
        });
    });

    describe("edge cases", () => {
        it("handles empty method parameters", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <method name="show" c:identifier="test_widget_show">
                        <return-value><type name="none"/></return-value>
                    </method>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].methods[0].parameters).toEqual([]);
        });

        it("handles missing c:prefix attribute", () => {
            const gir = `<?xml version="1.0"?>
                <repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0">
                    <namespace name="Test" version="1.0">
                    </namespace>
                </repository>`;
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.cPrefix).toBe("");
        });

        it("handles missing shared-library attribute", () => {
            const gir = `<?xml version="1.0"?>
                <repository version="1.2" xmlns="http://www.gtk.org/introspection/core/1.0">
                    <namespace name="Test" version="1.0">
                    </namespace>
                </repository>`;
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.sharedLibrary).toBe("");
        });

        it("handles signal with cleanup when value", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <glib:signal name="destroy" when="cleanup">
                        <return-value><type name="none"/></return-value>
                    </glib:signal>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].signals[0].when).toBe("cleanup");
        });

        it("handles invalid signal when value", () => {
            const gir = createMinimalGir(`
                <class name="Widget" c:type="TestWidget">
                    <glib:signal name="clicked" when="invalid">
                        <return-value><type name="none"/></return-value>
                    </glib:signal>
                </class>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.classes[0].signals[0].when).toBe("last");
        });

        it("handles private fields", () => {
            const gir = createMinimalGir(`
                <record name="WidgetClass" c:type="TestWidgetClass">
                    <field name="parent_class"><type name="GObject.ObjectClass"/></field>
                    <field name="padding" private="1"><type name="gpointer"/></field>
                </record>
            `);
            const parser = new GirParser();
            const result = parser.parse(gir);

            expect(result.records[0].fields[1].private).toBe(true);
        });
    });
});
