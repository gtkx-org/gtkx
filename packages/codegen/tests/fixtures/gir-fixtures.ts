import {
    GirCallback,
    GirClass,
    GirConstant,
    GirConstructor,
    GirEnumeration,
    GirEnumerationMember,
    GirField,
    GirFunction,
    GirInterface,
    GirMethod,
    GirNamespace,
    GirParameter,
    GirProperty,
    GirRecord,
    GirSignal,
    GirType,
    type QualifiedName,
    qualifiedName,
} from "@gtkx/gir";

type NormalizedTypeData = ConstructorParameters<typeof GirType>[0];
type NormalizedParameterData = ConstructorParameters<typeof GirParameter>[0];
type NormalizedMethodData = ConstructorParameters<typeof GirMethod>[0];
type NormalizedPropertyData = ConstructorParameters<typeof GirProperty>[0];
type NormalizedSignalData = ConstructorParameters<typeof GirSignal>[0];
type NormalizedConstructorData = ConstructorParameters<typeof GirConstructor>[0];
type NormalizedFunctionData = ConstructorParameters<typeof GirFunction>[0];
type NormalizedClassData = ConstructorParameters<typeof GirClass>[0];
type NormalizedInterfaceData = ConstructorParameters<typeof GirInterface>[0];
type NormalizedRecordData = ConstructorParameters<typeof GirRecord>[0];
type NormalizedFieldData = ConstructorParameters<typeof GirField>[0];
type NormalizedEnumerationData = ConstructorParameters<typeof GirEnumeration>[0];
type NormalizedEnumerationMemberData = ConstructorParameters<typeof GirEnumerationMember>[0];
type NormalizedCallbackData = ConstructorParameters<typeof GirCallback>[0];
type NormalizedConstantData = ConstructorParameters<typeof GirConstant>[0];
type NormalizedNamespaceData = ConstructorParameters<typeof GirNamespace>[0];

export { qualifiedName };
export type { QualifiedName };

export function createNormalizedType(overrides: Partial<NormalizedTypeData> = {}): GirType {
    return new GirType({
        name: "gint",
        isArray: false,
        elementType: null,
        nullable: false,
        ...overrides,
    });
}

export function createNormalizedParameter(overrides: Partial<NormalizedParameterData> = {}): GirParameter {
    return new GirParameter({
        name: "value",
        type: createNormalizedType(),
        direction: "in",
        callerAllocates: false,
        nullable: false,
        optional: false,
        ...overrides,
    });
}

export function createNormalizedMethod(overrides: Partial<NormalizedMethodData> = {}): GirMethod {
    return new GirMethod({
        name: "activate",
        cIdentifier: "gtk_widget_activate",
        returnType: createNormalizedType({ name: "none" }),
        parameters: [],
        throws: false,
        ...overrides,
    });
}

export function createNormalizedProperty(overrides: Partial<NormalizedPropertyData> = {}): GirProperty {
    return new GirProperty({
        name: "label",
        type: createNormalizedType({ name: "utf8" }),
        readable: true,
        writable: true,
        constructOnly: false,
        hasDefault: false,
        getter: "get_label",
        setter: "set_label",
        ...overrides,
    });
}

export function createNormalizedSignal(overrides: Partial<NormalizedSignalData> = {}): GirSignal {
    return new GirSignal({
        name: "clicked",
        when: "first",
        returnType: null,
        parameters: [],
        ...overrides,
    });
}

export function createNormalizedConstructor(overrides: Partial<NormalizedConstructorData> = {}): GirConstructor {
    return new GirConstructor({
        name: "new",
        cIdentifier: "gtk_button_new",
        returnType: createNormalizedType({ name: qualifiedName("Gtk", "Button") }),
        parameters: [],
        throws: false,
        ...overrides,
    });
}

export function createNormalizedFunction(overrides: Partial<NormalizedFunctionData> = {}): GirFunction {
    return new GirFunction({
        name: "init",
        cIdentifier: "gtk_init",
        returnType: createNormalizedType({ name: "none" }),
        parameters: [],
        throws: false,
        ...overrides,
    });
}

export function createNormalizedClass(overrides: Partial<NormalizedClassData> = {}): GirClass {
    const name = overrides.name ?? "Button";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new GirClass({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: `${namespace}${name}`,
        parent: qualifiedName("Gtk", "Widget"),
        abstract: false,
        glibTypeName: `${namespace}${name}`,
        glibGetType: `${namespace.toLowerCase()}_${name.toLowerCase()}_get_type`,
        implements: [],
        methods: [],
        constructors: [],
        staticFunctions: [],
        properties: [],
        signals: [],
        ...overrides,
    });
}

export function createNormalizedInterface(overrides: Partial<NormalizedInterfaceData> = {}): GirInterface {
    const name = overrides.name ?? "Orientable";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new GirInterface({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: `${namespace}${name}`,
        prerequisites: [],
        methods: [],
        properties: [],
        signals: [],
        ...overrides,
    });
}

export function createNormalizedField(overrides: Partial<NormalizedFieldData> = {}): GirField {
    return new GirField({
        name: "data",
        type: createNormalizedType(),
        writable: true,
        readable: true,
        private: false,
        ...overrides,
    });
}

export function createNormalizedRecord(overrides: Partial<NormalizedRecordData> = {}): GirRecord {
    const name = overrides.name ?? "Rectangle";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gdk";

    return new GirRecord({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: `${namespace}${name}`,
        opaque: false,
        disguised: false,
        fields: [],
        methods: [],
        constructors: [],
        staticFunctions: [],
        ...overrides,
    });
}

export function createNormalizedEnumerationMember(
    overrides: Partial<NormalizedEnumerationMemberData> = {},
): GirEnumerationMember {
    return new GirEnumerationMember({
        name: "HORIZONTAL",
        value: "0",
        cIdentifier: "GTK_ORIENTATION_HORIZONTAL",
        ...overrides,
    });
}

export function createNormalizedEnumeration(overrides: Partial<NormalizedEnumerationData> = {}): GirEnumeration {
    const name = overrides.name ?? "Orientation";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new GirEnumeration({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: `${namespace}${name}`,
        members: [
            createNormalizedEnumerationMember({ name: "HORIZONTAL", value: "0" }),
            createNormalizedEnumerationMember({ name: "VERTICAL", value: "1" }),
        ],
        ...overrides,
    });
}

export function createNormalizedCallback(overrides: Partial<NormalizedCallbackData> = {}): GirCallback {
    const name = overrides.name ?? "AsyncReadyCallback";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gio";

    return new GirCallback({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: `${namespace}${name}`,
        returnType: createNormalizedType({ name: "none" }),
        parameters: [],
        ...overrides,
    });
}

export function createNormalizedConstant(overrides: Partial<NormalizedConstantData> = {}): GirConstant {
    const name = overrides.name ?? "MAJOR_VERSION";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new GirConstant({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: "gint",
        value: "4",
        type: createNormalizedType(),
        ...overrides,
    });
}

export function createNormalizedNamespace(overrides: Partial<NormalizedNamespaceData> = {}): GirNamespace {
    const name = overrides.name ?? "Gtk";

    return new GirNamespace({
        name,
        version: "4.0",
        sharedLibrary: `lib${name.toLowerCase()}-4.so.1`,
        cPrefix: name,
        classes: new Map(),
        interfaces: new Map(),
        records: new Map(),
        enumerations: new Map(),
        bitfields: new Map(),
        callbacks: new Map(),
        functions: new Map(),
        constants: new Map(),
        ...overrides,
    });
}

export function createWidgetClass(overrides: Partial<NormalizedClassData> = {}): GirClass {
    return createNormalizedClass({
        name: "Widget",
        qualifiedName: qualifiedName("Gtk", "Widget"),
        cType: "GtkWidget",
        parent: qualifiedName("GObject", "InitiallyUnowned"),
        glibTypeName: "GtkWidget",
        glibGetType: "gtk_widget_get_type",
        properties: [
            createNormalizedProperty({ name: "visible", type: createNormalizedType({ name: "gboolean" }) }),
            createNormalizedProperty({ name: "sensitive", type: createNormalizedType({ name: "gboolean" }) }),
            createNormalizedProperty({ name: "can-focus", type: createNormalizedType({ name: "gboolean" }) }),
        ],
        signals: [createNormalizedSignal({ name: "destroy" }), createNormalizedSignal({ name: "show" })],
        ...overrides,
    });
}

export function createButtonClass(overrides: Partial<NormalizedClassData> = {}): GirClass {
    return createNormalizedClass({
        name: "Button",
        qualifiedName: qualifiedName("Gtk", "Button"),
        cType: "GtkButton",
        parent: qualifiedName("Gtk", "Widget"),
        glibTypeName: "GtkButton",
        glibGetType: "gtk_button_get_type",
        properties: [
            createNormalizedProperty({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
            createNormalizedProperty({
                name: "icon-name",
                type: createNormalizedType({ name: "utf8", nullable: true }),
            }),
        ],
        signals: [createNormalizedSignal({ name: "clicked" }), createNormalizedSignal({ name: "activate" })],
        constructors: [
            createNormalizedConstructor({ name: "new", cIdentifier: "gtk_button_new" }),
            createNormalizedConstructor({
                name: "new_with_label",
                cIdentifier: "gtk_button_new_with_label",
                parameters: [
                    createNormalizedParameter({ name: "label", type: createNormalizedType({ name: "utf8" }) }),
                ],
            }),
        ],
        methods: [
            createNormalizedMethod({
                name: "get_label",
                cIdentifier: "gtk_button_get_label",
                returnType: createNormalizedType({ name: "utf8", nullable: true }),
            }),
            createNormalizedMethod({
                name: "set_label",
                cIdentifier: "gtk_button_set_label",
                parameters: [
                    createNormalizedParameter({
                        name: "label",
                        type: createNormalizedType({ name: "utf8", nullable: true }),
                    }),
                ],
            }),
        ],
        ...overrides,
    });
}
