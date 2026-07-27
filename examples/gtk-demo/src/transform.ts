import * as Graphene from "@gtkx/gi/graphene";
import * as Gsk from "@gtkx/gi/gsk";

const at = (x: number, y: number, transform?: Gsk.Transform | null): Gsk.Transform | null => {
    let composed = Gsk.Transform.new().translate(Graphene.Point.create(x, y));

    if (composed !== null && transform != null) {
        composed = composed.transform(transform);
    }

    return composed;
};

export { at };
