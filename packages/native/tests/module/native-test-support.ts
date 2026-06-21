import * as native from "../../native-binding.cjs";

type RawHandle = Parameters<typeof native.watchObjectFinalize>[0];

export function watchObjectFinalize(handle: unknown): void {
    native.watchObjectFinalize(handle as RawHandle);
}

export function finalizeCount(): number {
    return native.finalizeCount();
}

export function driveToggleFromThread(handle: unknown, iterations: number): void {
    native.driveToggleFromThread(handle as RawHandle, iterations);
}
