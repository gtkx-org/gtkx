import { createCliProject, runCliOrThrow } from "./cli-project.js";
import { isolateTypeConsumer } from "./type-consumer.js";

const CONFIG = `export default {
    applicationId: "org.gtkx.hiddenproperties",
    libraries: ["HiddenProperties-1.0", "Gio-2.0"],
    girPath: ["./gir"],
    agents: { reference: false, rules: false },
};`;

const GIR = `<?xml version="1.0"?>
<repository version="1.2"
    xmlns="http://www.gtk.org/introspection/core/1.0"
    xmlns:c="http://www.gtk.org/introspection/c/1.0"
    xmlns:glib="http://www.gtk.org/introspection/glib/1.0">
  <include name="GObject" version="2.0"/>
  <namespace name="HiddenProperties" version="1.0" shared-library="libhiddenproperties.so.0"
      c:identifier-prefixes="HiddenProperties" c:symbol-prefixes="hidden_properties">
    <alias name="DataPointer" c:type="HiddenPropertiesDataPointer">
      <type name="gpointer" c:type="gpointer"/>
    </alias>
    <alias name="DataPointerAlias" c:type="HiddenPropertiesDataPointerAlias">
      <type name="DataPointer" c:type="HiddenPropertiesDataPointer"/>
    </alias>
    <class name="Probe" parent="GObject.Object" c:type="HiddenPropertiesProbe"
        glib:type-name="HiddenPropertiesProbe" glib:get-type="hidden_properties_probe_get_type">
      <property name="data" writable="1" transfer-ownership="none">
        <type name="gpointer" c:type="gpointer"/>
      </property>
      <property name="aliased-data" writable="1" transfer-ownership="none">
        <type name="DataPointerAlias" c:type="HiddenPropertiesDataPointerAlias"/>
      </property>
      <property name="count" writable="1" transfer-ownership="none">
        <type name="guint64" c:type="guint64"/>
      </property>
      <property name="type-id" writable="1" transfer-ownership="none">
        <type name="GType" c:type="GType"/>
      </property>
      <property name="owner" writable="1" transfer-ownership="none">
        <type name="GObject.Object" c:type="GObject*"/>
      </property>
      <property name="bytes" writable="1" transfer-ownership="none">
        <type name="GLib.Bytes" c:type="GBytes*"/>
      </property>
      <property name="names" writable="1" transfer-ownership="none">
        <array zero-terminated="1" c:type="gchar**"><type name="utf8" c:type="gchar*"/></array>
      </property>
    </class>
    <class name="Child" parent="Probe" c:type="HiddenPropertiesChild"
        glib:type-name="HiddenPropertiesChild" glib:get-type="hidden_properties_child_get_type"/>
    <class name="RawOnly" parent="GObject.Object" c:type="HiddenPropertiesRawOnly"
        glib:type-name="HiddenPropertiesRawOnly" glib:get-type="hidden_properties_raw_only_get_type">
      <property name="raw" writable="1" transfer-ownership="none">
        <type name="gpointer" c:type="gpointer"/>
      </property>
    </class>
    <class name="RawChild" parent="RawOnly" c:type="HiddenPropertiesRawChild"
        glib:type-name="HiddenPropertiesRawChild" glib:get-type="hidden_properties_raw_child_get_type">
      <property name="enabled" writable="1" transfer-ownership="none">
        <type name="gboolean" c:type="gboolean"/>
      </property>
    </class>
  </namespace>
</repository>
`;

const IMPORTS = `import * as Gio from "@gtkx/gi/gio";
import type * as GLib from "@gtkx/gi/glib";
import type * as GObject from "@gtkx/gi/gobject";
import * as HiddenProperties from "@gtkx/gi/hiddenproperties";
import { GMemoryOutputStream } from "@gtkx/jsx/gio";
import { HiddenPropertiesProbe, HiddenPropertiesChild, HiddenPropertiesRawOnly,
    HiddenPropertiesRawChild, type HiddenPropertiesProbeProps,
    type HiddenPropertiesChildProps } from "@gtkx/jsx/hiddenproperties";
import { registerClass } from "@gtkx/runtime";
`;

const ACCEPTED = IMPORTS + `
export const read = (probe: HiddenProperties.Probe) => {
    const count: bigint = probe.count;
    const typeId: bigint = probe.typeId;
    const owner: GObject.Object | null = probe.owner;
    const bytes: GLib.Bytes | null = probe.bytes;
    const names: string[] | null = probe.names;
    return { count, typeId, owner, bytes, names };
};
export const create = (owner: GObject.Object, bytes: GLib.Bytes, typeId: bigint) => {
    const props: HiddenProperties.ProbeConstructorProps = { count: 7n, typeId, owner, bytes, names: ["one"] };
    const probe = new HiddenProperties.Probe(props);
    probe.count = 9n;
    probe.typeId = typeId;
    probe.owner = owner;
    probe.bytes = bytes;
    probe.names = ["two"];
    const child = new HiddenProperties.Child(props);
    const nullable: HiddenProperties.ProbeConstructorProps = { owner: null, bytes: null, names: null };
    const values: (bigint | null)[] = [];
    const viewProps: HiddenPropertiesProbeProps = { count: 7n, typeId, owner, bytes, names: ["one"] };
    const childViewProps: HiddenPropertiesChildProps = { owner: null, bytes: null, names: null, count: 0n };
    const view = <HiddenPropertiesProbe {...viewProps} onNotifyCount={(value) => values.push(value)} />;
    const childView = <HiddenPropertiesChild {...childViewProps} onNotifyCount={() => undefined} />;
    return { probe, child, view, childView };
};
class CustomProbe extends HiddenProperties.Probe {}
const RegisteredProbe = registerClass(CustomProbe, { typeName: "GtkxHiddenPropertyProbe" });
export const registered = new RegisteredProbe({ count: 3n });
export const rawOnly = new HiddenProperties.RawOnly();
export const rawChild = new HiddenProperties.RawChild({ enabled: true });
export const emptyOptions: HiddenProperties.RawOnlyConstructorProps = {};
export const rawViews = [<HiddenPropertiesRawOnly />, <HiddenPropertiesRawChild enabled />];
export const streamProps: Gio.MemoryOutputStreamConstructorProps = { size: 0n };
export const streamView = <GMemoryOutputStream size={0n} onNotifyDataSize={() => undefined} />;
`;

const REJECTED = {
    "direct-read": "export const read = (value: HiddenProperties.Probe) => value.data;",
    "aliased-read": "export const read = (value: HiddenProperties.Probe) => value.aliasedData;",
    "direct-write": "export const write = (value: HiddenProperties.Probe) => { value.data = null; };",
    "inherited-aliased-write": "export const write = (value: HiddenProperties.Child) => { value.aliasedData = null; };",
    "direct-constructor": "export const value = new HiddenProperties.Probe({ data: null });",
    "inherited-aliased-constructor": "export const value = new HiddenProperties.Child({ aliasedData: null });",
    "direct-jsx": "export const view = <HiddenPropertiesProbe data={null} />;",
    "inherited-aliased-jsx": "export const view = <HiddenPropertiesChild aliasedData={null} />;",
    "direct-notify": "export const view = <HiddenPropertiesProbe onNotifyData={() => undefined} />;",
    "inherited-aliased-notify": "export const view = <HiddenPropertiesChild onNotifyAliasedData={() => undefined} />;",
    "raw-only-constructor": "export const value = new HiddenProperties.RawOnly({ raw: null });",
    "raw-only-options": "export const props: HiddenProperties.RawOnlyConstructorProps = { raw: null };",
    "raw-child-constructor": "export const value = new HiddenProperties.RawChild({ enabled: true, raw: null });",
    "raw-only-jsx": "export const view = <HiddenPropertiesRawOnly raw={null} />;",
    "stream-read": "export const read = (value: Gio.MemoryOutputStream) => value.data;",
    "stream-constructor": "export const props: Gio.MemoryOutputStreamConstructorProps = { data: null };",
    "stream-destroy-option": "export const props: Gio.MemoryOutputStreamConstructorProps = { destroyFunction: null };",
    "stream-realloc-option": "export const props: Gio.MemoryOutputStreamConstructorProps = { reallocFunction: null };",
    "stream-jsx": "export const view = <GMemoryOutputStream data={null} />;",
    "stream-notify": "export const view = <GMemoryOutputStream onNotifyData={() => undefined} />;",
    "integer-control": "export const props: HiddenProperties.ProbeConstructorProps = { count: \"invalid\" };",
} as const;

type RejectedName = keyof typeof REJECTED;

const createHiddenPropertiesProject = (
    prefix: string,
    acceptedFiles: Record<string, string>,
    rejectedNames: readonly RejectedName[] = [],
): ReturnType<typeof createCliProject> => {
    const rejectedFiles = Object.fromEntries(rejectedNames.map((name) => [
        `${name}.tsx`,
        IMPORTS + REJECTED[name],
    ]));
    const project = createCliProject({
        prefix,
        config: CONFIG,
        files: {
            "gir/HiddenProperties-1.0.gir": GIR,
            ...acceptedFiles,
            ...rejectedFiles,
        },
    });

    runCliOrThrow(project, ["codegen"]);
    isolateTypeConsumer(project);

    return project;
};

export { ACCEPTED, createHiddenPropertiesProject, type RejectedName };
