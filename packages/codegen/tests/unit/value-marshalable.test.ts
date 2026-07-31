import { describe, expect, it } from "vitest";
import type { GirNamespace } from "../../src/gir/namespace.js";
import type { GirRecord } from "../../src/gir/record.js";
import { isValueMarshalable } from "../../src/store/gi/value-marshalable.js";
import { ModuleContext } from "../../src/writer/context.js";
import { library } from "../helpers/library.js";

const namespaceNamed = (name: string): GirNamespace => {
    const namespace = library.namespaces.get(name);

    if (namespace === undefined) {
        throw new Error(`The ${name} namespace is not loaded`);
    }

    return namespace;
};

const recordNamed = (namespaceName: string, recordName: string): GirRecord => {
    const record = namespaceNamed(namespaceName).records.find((candidate) => candidate.name === recordName);

    if (record === undefined) {
        throw new Error(`${namespaceName}.${recordName} was not found`);
    }

    return record;
};

const isMarshalable = (namespaceName: string, recordName: string): boolean =>
    isValueMarshalable(
        new ModuleContext(namespaceNamed(namespaceName), library),
        namespaceName,
        recordNamed(namespaceName, recordName),
    );

describe("isValueMarshalable", () => {
    it("accepts a record whose every field is transitively a scalar", () => {
        expect(isMarshalable("Graphene", "Size")).toBe(true);
    });

    // The traversal guards against a cycle, not against a type appearing more than once. `GskRoundedRect`
    // holds a `graphene_rect_t` and four `graphene_size_t`, so `Graphene.Size` is reached twice: once
    // under `bounds`, once under `corner`. A guard that never unwinds rejects the second visit and takes
    // the whole all-scalar struct with it.
    it("accepts a record that reaches the same field type twice", () => {
        expect(isMarshalable("Gsk", "RoundedRect")).toBe(true);
    });

    it("rejects a record holding a pointer", () => {
        expect(isMarshalable("Pango", "Analysis")).toBe(false);
    });

    it("rejects a record holding a string", () => {
        expect(isMarshalable("GLib", "OptionEntry")).toBe(false);
    });
});
