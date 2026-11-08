import { ParameterType, ReflectionKind } from "typedoc";
import { MemberRouter } from "typedoc-plugin-markdown";

const OPTION = "publicModuleNames";
const ROUTE_UNSAFE = /[^\w.~@-]/g;

const toRouteSafeSegment = (segment) => segment.replaceAll(ROUTE_UNSAFE, "_");
const getPublicName = (names, alias) => names?.find((name) => alias === name || alias.endsWith(`/${name}`)) ?? alias;
const getImportSpecifier = (packageName, name) => (name === "index" ? packageName : `${packageName}/${name}`);

const load = (app) => {
    app.options.addDeclaration({
        defaultValue: {},
        help: "Maps each documented package to the export subpaths its modules are published under.",
        name: OPTION,
        type: ParameterType.Mixed,
    });

    app.renderer.defineRouter("route-safe", RouteSafeRouter);
};

class RouteSafeRouter extends MemberRouter {
    publicModuleNames = this.application.options.getValue(OPTION);
    moduleAliases = new Map();

    buildPages(project) {
        for (const reflection of project.getReflectionsByKind(ReflectionKind.Module)) {
            const packageName = reflection.parent?.name ?? "";
            const publicName = this.getPublicModuleName(reflection);

            if (packageName in this.publicModuleNames) {
                this.moduleAliases.set(reflection, publicName);
                reflection.name = getImportSpecifier(packageName, publicName);
            } else {
                reflection.name = publicName;
            }
        }

        return super.buildPages(project);
    }

    getPublicModuleName(reflection) {
        return getPublicName(this.publicModuleNames[reflection.parent?.name ?? ""], reflection.name);
    }

    getReflectionAlias(reflection) {
        const alias = this.moduleAliases.get(reflection) ?? super.getReflectionAlias(reflection);
        const names = this.publicModuleNames[reflection.parent?.name ?? ""];

        return getPublicName(names, alias)
            .split("/")
            .map((segment) => toRouteSafeSegment(segment))
            .join("/");
    }
}

export { load };
