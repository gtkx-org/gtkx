import type { Handle } from "./binding.js";
import * as native from "./index.js";

export function watchObjectFinalize(handle: Handle): void {
    native.watchObjectFinalize(handle);
}

export function finalizeCount(): number {
    return native.finalizeCount();
}

export function driveToggleFromThread(handle: Handle, iterations: number): void {
    native.driveToggleFromThread(handle, iterations);
}
