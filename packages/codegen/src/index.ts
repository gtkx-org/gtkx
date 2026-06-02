/**
 * Public API of `@gtkx/codegen`.
 *
 * The package exposes a single entry point — {@link CodegenRunner} — that
 * orchestrates the GIR-driven code generation for the FFI and React
 * surfaces. Internal modules (`gir/`, `dsl/`, `writers/`, `ffi/`,
 * `react/`) are not part of the supported surface and may change in any
 * release.
 */
export {
    CODEGEN_VERSION,
    type CodegenFingerprint,
    computeFingerprint,
    FINGERPRINT_FILENAME,
} from "./fingerprint.js";
export { CodegenRunner } from "./runner.js";
