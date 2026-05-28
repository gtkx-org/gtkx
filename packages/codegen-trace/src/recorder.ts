/**
 * Recorder for the *shape* of every `@gtkx/native` operation a test exercises.
 *
 * The recorder is deliberately blind to argument values, return values, and
 * handle/GType identity — those vary across runs (frame-clock timing, GC
 * cadence, async signal ordering) and would defeat a byte-exact golden
 * manifest. What it captures is the projection codegen produces: the FFI
 * function dispatched (library + symbol), the argument and return type
 * descriptors, the class registrations, the memory marshalling patterns,
 * etc.
 *
 * Within a test file the recorder collects each distinct shape into a `Set`
 * and emits the sorted union at file end, so the on-disk snapshot bytes are
 * canonical and `sha256(file)` is the manifest digest.
 */

import type { Arg, Type } from "@gtkx/native";

/**
 * Sink the recorder calls once when the test file finishes.
 *
 * The setup file owns the file descriptor; the recorder hands it the sorted
 * union of distinct shapes one line at a time and lets the sink flush them.
 */
export type Sink = (line: string) => void;

/** Tagged union of every shape kind the recorder emits. */
export type Shape =
    | {
          readonly op: "call";
          readonly library: string;
          readonly symbol: string;
          readonly argTypes: readonly { readonly type: Type; readonly optional?: boolean }[];
          readonly returnType: Type;
      }
    | {
          readonly op: "alloc";
          readonly size: number;
          readonly glibTypeName: string | null;
          readonly library: string | null;
      }
    | {
          readonly op: "read";
          readonly type: Type;
          readonly offset: number;
      }
    | {
          readonly op: "write";
          readonly type: Type;
          readonly offset: number;
      }
    | {
          readonly op: "registerClass";
          readonly name: string;
          readonly vfuncs: readonly { byteOffset: number; argTypes: readonly Type[]; returnType: Type }[];
          readonly interfaceVfuncs: readonly {
              vfuncs: readonly { byteOffset: number; argTypes: readonly Type[]; returnType: Type }[];
          }[];
      }
    | {
          readonly op: "findObjectProperty";
          readonly propertyName: string;
      };

/**
 * Process-global shape accumulator.
 *
 * The proxy wrapper invokes the `recordX` methods unconditionally; the
 * recorder is responsible for dropping calls when no sink is bound. Use the
 * singleton {@link recorder} — the class is exposed only for its typed
 * surface.
 */
export class Recorder {
    private shapes: Set<string> | null = null;

    /** Begins recording shapes into a fresh set. */
    begin(): void {
        this.shapes = new Set();
    }

    /** Flushes the sorted shapes to the sink and stops recording. */
    end(sink: Sink): void {
        const shapes = this.shapes;
        if (shapes === null) return;
        const sorted = [...shapes].sort();
        for (const shape of sorted) sink(shape);
        this.shapes = null;
    }

    /** Whether the wrapper should record into the shape set. */
    get isRecording(): boolean {
        return this.shapes !== null;
    }

    private add(shape: Shape): void {
        const set = this.shapes;
        if (set === null) return;
        set.add(JSON.stringify(shape));
    }

    /** Records a `call` shape. */
    recordCall(library: string, symbol: string, args: readonly Arg[], returnType: Type): void {
        this.add({
            op: "call",
            library,
            symbol,
            argTypes: args.map((arg) =>
                arg.optional !== undefined ? { type: arg.type, optional: arg.optional } : { type: arg.type },
            ),
            returnType,
        });
    }

    /** Records an `alloc` shape. */
    recordAlloc(size: number, glibTypeName: string | undefined, library: string | undefined): void {
        this.add({ op: "alloc", size, glibTypeName: glibTypeName ?? null, library: library ?? null });
    }

    /** Records a `read` shape. */
    recordRead(type: Type, offset: number): void {
        this.add({ op: "read", type, offset });
    }

    /** Records a `write` shape. */
    recordWrite(type: Type, offset: number): void {
        this.add({ op: "write", type, offset });
    }

    /** Records a `registerClass` shape. */
    recordRegisterClass(
        name: string,
        vfuncs: readonly { byteOffset: number; argTypes: readonly Type[]; returnType: Type }[],
        interfaceVfuncs: readonly {
            vfuncs: readonly { byteOffset: number; argTypes: readonly Type[]; returnType: Type }[];
        }[],
    ): void {
        this.add({
            op: "registerClass",
            name,
            vfuncs: vfuncs.map(({ byteOffset, argTypes, returnType }) => ({
                byteOffset,
                argTypes: [...argTypes],
                returnType,
            })),
            interfaceVfuncs: interfaceVfuncs.map(({ vfuncs: members }) => ({
                vfuncs: members.map(({ byteOffset, argTypes, returnType }) => ({
                    byteOffset,
                    argTypes: [...argTypes],
                    returnType,
                })),
            })),
        });
    }

    /** Records a `findObjectProperty` shape. */
    recordFindObjectProperty(propertyName: string): void {
        this.add({ op: "findObjectProperty", propertyName });
    }
}

/** Process-global recorder instance shared by the wrapper module. */
export const recorder = new Recorder();
