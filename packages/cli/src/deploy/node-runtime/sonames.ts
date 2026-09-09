const GLIBC_SONAMES = [
    "ld-linux-aarch64.so.1",
    "ld-linux-x86-64.so.2",
    "libc.so.6",
    "libdl.so.2",
    "libm.so.6",
    "libpthread.so.0",
    "librt.so.1",
] as const;

const PACKAGED_SONAMES = ["libatomic.so.1", "libgcc_s.so.1", "libstdc++.so.6"] as const;

type PackagedSoname = (typeof PACKAGED_SONAMES)[number];

const RUNTIME_SONAMES: Set<string> = new Set([...GLIBC_SONAMES, ...PACKAGED_SONAMES]);

export { PACKAGED_SONAMES, type PackagedSoname, RUNTIME_SONAMES };
