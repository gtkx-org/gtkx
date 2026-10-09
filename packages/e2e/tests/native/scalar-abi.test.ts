import * as GIMarshallingTests from "@gtkx/gi/gimarshallingtests";
import * as Regress from "@gtkx/gi/regress";
import { expect, test } from "vitest";

test("off_t preserves signed file offsets through each argument direction", () => {
    expect(GIMarshallingTests.offTReturn()).toBe(1234567890n);
    GIMarshallingTests.offTIn(1234567890n);
    expect(GIMarshallingTests.offTOut()).toBe(1234567890n);
    expect(GIMarshallingTests.offTInout(1234567890n)).toBe(0n);
    expect(GIMarshallingTests.offTOutUninitialized()).toEqual([false, 0n]);
    for (const offset of [-(2n ** 63n), -1n, 0n, 2n ** 63n - 1n]) {
        expect(Regress.testOfft(offset)).toBe(offset);
    }
    expect(() => Regress.testOfft(2n ** 63n)).toThrow();
    expect(() => Regress.testOfft(-(2n ** 63n) - 1n)).toThrow();
});

test("dev_t preserves unsigned device identifiers through each argument direction", () => {
    expect(GIMarshallingTests.devTReturn()).toBe(1234567890n);
    GIMarshallingTests.devTIn(1234567890n);
    expect(GIMarshallingTests.devTOut()).toBe(1234567890n);
    expect(GIMarshallingTests.devTInout(1234567890n)).toBe(0n);
    expect(GIMarshallingTests.devTOutUninitialized()).toEqual([false, 0n]);
    expect(() => GIMarshallingTests.devTIn(-1n)).toThrow();
    expect(() => GIMarshallingTests.devTIn(2n ** 64n)).toThrow();
});

test("socklen_t uses its unsigned 32-bit ABI through each argument direction", () => {
    expect(GIMarshallingTests.socklenTReturn()).toBe(123);
    GIMarshallingTests.socklenTIn(123);
    expect(GIMarshallingTests.socklenTOut()).toBe(123);
    expect(GIMarshallingTests.socklenTInout(123)).toBe(0);
    expect(GIMarshallingTests.socklenTOutUninitialized()).toEqual([false, 0]);
    expect(() => GIMarshallingTests.socklenTIn(-1)).toThrow();
    expect(() => GIMarshallingTests.socklenTIn(2 ** 32)).toThrow();
});
