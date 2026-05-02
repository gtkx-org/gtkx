import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { GirParser } from "./parser.js";
import type { RawNamespace } from "./raw-types.js";

/**
 * Handles GIR file discovery, dependency graph resolution, and loading.
 *
 * Given a list of root namespace keys (e.g., `["Gtk-4.0"]`) and search paths,
 * discovers all transitive dependencies via `<include>` tags, topologically
 * sorts them, and returns fully parsed raw namespaces in dependency order.
 */
export class GirLoader {
    private readonly girPath: string[];
    private readonly parser: GirParser;

    constructor(girPath: string[]) {
        this.girPath = girPath;
        this.parser = new GirParser();
    }

    /**
     * Loads all GIR namespaces required by the given roots, including
     * all transitive dependencies discovered via `<include>` tags.
     *
     * @returns Raw namespaces keyed by namespace name, in dependency order.
     */
    async loadAll(roots: string[]): Promise<Map<string, { raw: RawNamespace; xml: string }>> {
        const fileMap = await this.discoverDependencies(roots);
        const sorted = this.topologicalSort(fileMap);

        const result = new Map<string, { raw: RawNamespace; xml: string }>();
        for (const key of sorted) {
            const entry = fileMap.get(key);
            if (!entry) continue;
            const filePath = entry.filePath;
            const xml = await readFile(filePath, "utf-8");
            const raw = this.parser.parseNamespace(xml);
            result.set(raw.name, { raw, xml });
        }

        return result;
    }

    async discoverDependencies(roots: string[]): Promise<Map<string, { filePath: string; dependencies: string[] }>> {
        const graph = new Map<string, { filePath: string; dependencies: string[] }>();
        const queue = [...roots];

        while (queue.length > 0) {
            const key = queue.shift();
            if (key === undefined || graph.has(key)) continue;

            const filePath = this.findGirFile(key);
            const xml = await readFile(filePath, "utf-8");
            const header = this.parser.parseHeader(xml);

            const dependencies = header.dependencies.map((dep) => `${dep.name}-${dep.version}`);

            graph.set(key, { filePath, dependencies });

            for (const dep of dependencies) {
                if (!graph.has(dep)) {
                    queue.push(dep);
                }
            }
        }

        return graph;
    }

    private findGirFile(namespaceKey: string): string {
        const filename = `${namespaceKey}.gir`;
        for (const dir of this.girPath) {
            const filePath = join(dir, filename);
            if (existsSync(filePath)) {
                return filePath;
            }
        }
        throw new Error(`GIR file not found for "${namespaceKey}" in paths: [${this.girPath.join(", ")}]`);
    }

    private topologicalSort(graph: Map<string, { filePath: string; dependencies: string[] }>): string[] {
        const { inDegree, dependents } = this.buildDependencyMaps(graph);
        const queue = this.collectInitialQueue(inDegree);
        const sorted = this.processQueue(queue, inDegree, dependents);

        if (sorted.length !== graph.size) {
            const remaining = [...graph.keys()].filter((k) => !sorted.includes(k));
            throw new Error(`Circular GIR dependency detected involving: ${remaining.join(", ")}`);
        }

        return sorted;
    }

    private buildDependencyMaps(graph: Map<string, { filePath: string; dependencies: string[] }>): {
        inDegree: Map<string, number>;
        dependents: Map<string, string[]>;
    } {
        const inDegree = new Map<string, number>();
        const dependents = new Map<string, string[]>();

        for (const key of graph.keys()) {
            dependents.set(key, []);
        }

        for (const [key, { dependencies }] of graph) {
            inDegree.set(key, dependencies.filter((d) => graph.has(d)).length);
            for (const dep of dependencies) {
                dependents.get(dep)?.push(key);
            }
        }

        return { inDegree, dependents };
    }

    private collectInitialQueue(inDegree: Map<string, number>): string[] {
        const queue: string[] = [];
        for (const [key, degree] of inDegree) {
            if (degree === 0) queue.push(key);
        }
        return queue;
    }

    private processQueue(
        queue: string[],
        inDegree: Map<string, number>,
        dependents: Map<string, string[]>,
    ): string[] {
        const sorted: string[] = [];
        while (queue.length > 0) {
            const key = queue.shift();
            if (key === undefined) break;
            sorted.push(key);

            for (const dependent of dependents.get(key) ?? []) {
                const newDegree = (inDegree.get(dependent) ?? 0) - 1;
                inDegree.set(dependent, newDegree);
                if (newDegree === 0) queue.push(dependent);
            }
        }
        return sorted;
    }
}
