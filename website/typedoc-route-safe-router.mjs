import { ParameterType, ReflectionKind } from "typedoc";
import { MemberRouter } from "typedoc-plugin-markdown";

const OPTION = "publicModuleNames";
const ROUTE_UNSAFE = /[^\w.~@-]/g;

const toRouteSafeSegment = (segment) => segment.replaceAll(ROUTE_UNSAFE, "_");
const getPublicName = (names, alias) => names?.find((name) => alias === name || alias.endsWith(`/${name}`)) ?? alias;

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

    buildPages(project) {
        for (const reflection of project.getReflectionsByKind(ReflectionKind.Module)) {
            reflection.name = this.getPublicModuleName(reflection);
        }

        return super.buildPages(project);
    }

    getPublicModuleName(reflection) {
        return getPublicName(this.publicModuleNames[reflection.parent?.name ?? ""], reflection.name);
    }

    getReflectionAlias(reflection) {
        const alias = super.getReflectionAlias(reflection);
        const names = this.publicModuleNames[reflection.parent?.name ?? ""];

        return getPublicName(names, alias)
            .split("/")
            .map((segment) => toRouteSafeSegment(segment))
            .join("/");
    }
}

export { load };
