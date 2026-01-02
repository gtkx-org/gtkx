import {
    NormalizedCallback,
    NormalizedClass,
    NormalizedConstant,
    NormalizedConstructor,
    NormalizedEnumeration,
    NormalizedEnumerationMember,
    NormalizedField,
    NormalizedFunction,
    NormalizedInterface,
    NormalizedMethod,
    NormalizedNamespace,
    NormalizedParameter,
    NormalizedProperty,
    NormalizedRecord,
    NormalizedSignal,
    NormalizedType,
    type QualifiedName,
    qualifiedName,
} from "@gtkx/gir";

type NormalizedTypeData = ConstructorParameters<typeof NormalizedType>[0];
type NormalizedParameterData = ConstructorParameters<typeof NormalizedParameter>[0];
type NormalizedMethodData = ConstructorParameters<typeof NormalizedMethod>[0];
type NormalizedPropertyData = ConstructorParameters<typeof NormalizedProperty>[0];
type NormalizedSignalData = ConstructorParameters<typeof NormalizedSignal>[0];
type NormalizedConstructorData = ConstructorParameters<typeof NormalizedConstructor>[0];
type NormalizedFunctionData = ConstructorParameters<typeof NormalizedFunction>[0];
type NormalizedClassData = ConstructorParameters<typeof NormalizedClass>[0];
type NormalizedInterfaceData = ConstructorParameters<typeof NormalizedInterface>[0];
type NormalizedRecordData = ConstructorParameters<typeof NormalizedRecord>[0];
type NormalizedFieldData = ConstructorParameters<typeof NormalizedField>[0];
type NormalizedEnumerationData = ConstructorParameters<typeof NormalizedEnumeration>[0];
type NormalizedEnumerationMemberData = ConstructorParameters<typeof NormalizedEnumerationMember>[0];
type NormalizedCallbackData = ConstructorParameters<typeof NormalizedCallback>[0];
type NormalizedConstantData = ConstructorParameters<typeof NormalizedConstant>[0];
type NormalizedNamespaceData = ConstructorParameters<typeof NormalizedNamespace>[0];

export { qualifiedName };
export type { QualifiedName };

export function createNormalizedType(overrides: Partial<NormalizedTypeData> = {}): NormalizedType {
    return new NormalizedType({
        name: "gint",
        isArray: false,
        elementType: null,
        nullable: false,
        ...overrides,
    });
}

export function createNormalizedParameter(overrides: Partial<NormalizedParameterData> = {}): NormalizedParameter {
    return new NormalizedParameter({
        name: "value",
        type: createNormalizedType(),
        direction: "in",
        callerAllocates: false,
        nullable: false,
        optional: false,
        ...overrides,
    });
}

export function createNormalizedMethod(overrides: Partial<NormalizedMethodData> = {}): NormalizedMethod {
    return new NormalizedMethod({
        name: "activate",
        cIdentifier: "gtk_widget_activate",
        returnType: createNormalizedType({ name: "none" }),
        parameters: [],
        throws: false,
        ...overrides,
    });
}

export function createNormalizedProperty(overrides: Partial<NormalizedPropertyData> = {}): NormalizedProperty {
    return new NormalizedProperty({
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

export function createNormalizedSignal(overrides: Partial<NormalizedSignalData> = {}): NormalizedSignal {
    return new NormalizedSignal({
        name: "clicked",
        when: "first",
        returnType: null,
        parameters: [],
        ...overrides,
    });
}

export function createNormalizedConstructor(overrides: Partial<NormalizedConstructorData> = {}): NormalizedConstructor {
    return new NormalizedConstructor({
        name: "new",
        cIdentifier: "gtk_button_new",
        returnType: createNormalizedType({ name: qualifiedName("Gtk", "Button") }),
        parameters: [],
        throws: false,
        ...overrides,
    });
}

export function createNormalizedFunction(overrides: Partial<NormalizedFunctionData> = {}): NormalizedFunction {
    return new NormalizedFunction({
        name: "init",
        cIdentifier: "gtk_init",
        returnType: createNormalizedType({ name: "none" }),
        parameters: [],
        throws: false,
        ...overrides,
    });
}

export function createNormalizedClass(overrides: Partial<NormalizedClassData> = {}): NormalizedClass {
    const name = overrides.name ?? "Button";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new NormalizedClass({
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

export function createNormalizedInterface(overrides: Partial<NormalizedInterfaceData> = {}): NormalizedInterface {
    const name = overrides.name ?? "Orientable";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new NormalizedInterface({
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

export function createNormalizedField(overrides: Partial<NormalizedFieldData> = {}): NormalizedField {
    return new NormalizedField({
        name: "data",
        type: createNormalizedType(),
        writable: true,
        readable: true,
        private: false,
        ...overrides,
    });
}

export function createNormalizedRecord(overrides: Partial<NormalizedRecordData> = {}): NormalizedRecord {
    const name = overrides.name ?? "Rectangle";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gdk";

    return new NormalizedRecord({
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
): NormalizedEnumerationMember {
    return new NormalizedEnumerationMember({
        name: "HORIZONTAL",
        value: "0",
        cIdentifier: "GTK_ORIENTATION_HORIZONTAL",
        ...overrides,
    });
}

export function createNormalizedEnumeration(overrides: Partial<NormalizedEnumerationData> = {}): NormalizedEnumeration {
    const name = overrides.name ?? "Orientation";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new NormalizedEnumeration({
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

export function createNormalizedCallback(overrides: Partial<NormalizedCallbackData> = {}): NormalizedCallback {
    const name = overrides.name ?? "AsyncReadyCallback";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gio";

    return new NormalizedCallback({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: `${namespace}${name}`,
        returnType: createNormalizedType({ name: "none" }),
        parameters: [],
        ...overrides,
    });
}

export function createNormalizedConstant(overrides: Partial<NormalizedConstantData> = {}): NormalizedConstant {
    const name = overrides.name ?? "MAJOR_VERSION";
    const namespace = overrides.qualifiedName?.split(".")[0] ?? "Gtk";

    return new NormalizedConstant({
        name,
        qualifiedName: qualifiedName(namespace, name),
        cType: "gint",
        value: "4",
        type: createNormalizedType(),
        ...overrides,
    });
}

export function createNormalizedNamespace(overrides: Partial<NormalizedNamespaceData> = {}): NormalizedNamespace {
    const name = overrides.name ?? "Gtk";

    return new NormalizedNamespace({
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

export function createWidgetClass(overrides: Partial<NormalizedClassData> = {}): NormalizedClass {
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

export function createButtonClass(overrides: Partial<NormalizedClassData> = {}): NormalizedClass {
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
