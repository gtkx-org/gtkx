import { execFileSync } from "node:child_process";
import { globSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { isDeepStrictEqual } from "node:util";
import { collectExecutedCoverage, keyFor } from "./native-fixtures-executed.js";
import { auditNativeFixtureOmissions } from "./native-fixtures-omissions.js";

const tests = join(import.meta.dirname, "../native");
const directory = join(tests, "../../../../build/native-tests/coverage");
const suites = globSync("**/*.test.ts", { cwd: tests, exclude: ["**/node_modules/**"] }).sort();
const reports = globSync("**/*.test.ts.json", { cwd: directory })
    .map((name) => name.slice(0, -5))
    .sort();
if (JSON.stringify(suites) !== JSON.stringify(reports)) {
    throw new Error(
        "Native coverage requires fresh reports from every suite. Run pnpm test:asan --skip-nx-cache without filters.",
    );
}

const unavailable = {
    GIMarshallingTests: [
        {
            reason: "Abstract record with no upstream constructor, factory or function returning an instance.",
            members: ["NotSimpleStruct.get:pointer", "NotSimpleStruct.set:pointer"],
        },
        {
            reason: "Abstract union with no upstream constructor, factory or function returning an instance.",
            members: [
                "UnregisteredUnion.get:long",
                "UnregisteredUnion.set:long",
                "UnregisteredUnion.get:size",
                "UnregisteredUnion.set:size",
                "UnregisteredUnion.get:str",
                "UnregisteredUnion.set:str",
            ],
        },
    ],
    Regress: [
        {
            reason: "Private owned pointer; overwriting it would corrupt the boxed destructor's ownership.",
            members: ["TestBoxed.set:priv"],
        },
        {
            reason: "Native reference-count bookkeeping; arbitrary mutation invalidates object lifetime.",
            members: ["TestBoxedC.set:refcount"],
        },
    ],
};
const diagnosticOnly = {
    GIMarshallingTests: ["Object.method:fullIn", "Object.method:methodVariantArrayIn"],
    Regress: [
        "Regress.function:fooAsyncReadyCallback",
        "Regress.function:fooDestroyNotifyCallback",
        "Regress.function:fooTestConstCharParam",
        "Regress.function:fooTestConstCharRetval",
        "Regress.function:fooTestConstStructParam",
        "Regress.function:fooTestConstStructRetval",
        "Regress.function:fooTestUnsignedType",
        "Regress.function:setAbortOnError",
        "FooDBusData.method:method",
        "FooBUnion.method:getContainedType",
    ],
};
const coverage = collectExecutedCoverage(directory);
for (const namespace of ["GIMarshallingTests", "Regress"] as const) {
    const entry = coverage[namespace];
    const excluded = new Set(unavailable[namespace].flatMap((group) => group.members));
    const missing = entry.remaining.map(keyFor);
    const gaps = missing.filter((key) => !excluded.has(key));
    const obsolete = [...excluded].filter((key) => !missing.includes(key));
    const untestedDiagnostics = diagnosticOnly[namespace].filter((key) => entry.evidence[key] === undefined);
    if (gaps.length > 0 || obsolete.length > 0 || untestedDiagnostics.length > 0) {
        throw new Error(
            JSON.stringify({ namespace, untested: gaps, obsoleteExclusions: obsolete, untestedDiagnostics }, null, 4),
        );
    }
    console.info(
        `${namespace}: ${entry.executed}/${entry.generated} generated APIs executed; ${excluded.size} documented exclusions.`,
    );
}

const summarize = (namespace: keyof typeof coverage) => ({
    generated: coverage[namespace].generated,
    executed: coverage[namespace].executed,
    unavailable: unavailable[namespace],
    diagnosticOnly: diagnosticOnly[namespace],
});
const upstreamSurface = auditNativeFixtureOmissions(join(tests, "../../../.."));
for (const namespace of upstreamSurface) {
    if (
        namespace.omittedCallables.length > 0 ||
        namespace.omittedSignals.length > 0 ||
        namespace.omittedProperties.length > 0 ||
        namespace.omittedVirtualMethods.length > 0
    ) {
        throw new Error(`Upstream GIR declarations lost generated bindings: ${JSON.stringify(namespace, null, 4)}`);
    }
}
const inventory = {
    upstream: "https://github.com/GNOME/gobject-introspection-tests",
    revision: "5987255086f59ca271a3a0aa53fbbb15b189be65",
    refresh:
        "Run pnpm test:asan --skip-nx-cache without filters, then pnpm exec tsx packages/e2e/tests/helpers/native-fixtures-coverage.ts --write",
    methodology:
        "V8 precise execution coverage of generated namespace functions, concrete constructors, class/interface methods and each getter/setter, matched by receiver and source range. Native tests assert their upstream contracts under ASan with per-test LSan. This measures generated callable coverage, not C branch coverage. The raw GIR audit independently requires bindings for every introspectable callable, signal, property access mode and virtual method; lifecycle-only vfuncs require metadata but have no generated call proxy. Declarations disabled by the upstream scanner are listed separately. Signal contracts are asserted separately by the signal and property suites. diagnosticOnly entries assert missing upstream C symbols; they do not execute a native implementation.",
    evidence: "build/native-tests/coverage/inventory.json",
    suites,
    upstreamSurface,
    namespaces: {
        GIMarshallingTests: summarize("GIMarshallingTests"),
        Regress: summarize("Regress"),
    },
};
const snapshot = join(tests, "coverage-inventory.json");
const serialized = `${JSON.stringify(inventory, null, 4)}\n`;
writeFileSync(join(directory, "inventory.json"), `${JSON.stringify(coverage, null, 4)}\n`);
if (process.argv.includes("--write")) {
    writeFileSync(snapshot, serialized);
    execFileSync("pnpm", ["exec", "oxfmt", "--write", snapshot], { cwd: join(tests, "../../../..") });
} else if (!isDeepStrictEqual(JSON.parse(readFileSync(snapshot, "utf8")), inventory)) {
    throw new Error(
        "Native coverage inventory changed. Review it, then run pnpm exec tsx packages/e2e/tests/helpers/native-fixtures-coverage.ts --write.",
    );
}
