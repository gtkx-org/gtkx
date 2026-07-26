import type { GlParam } from "./model.js";
import type { CommandPlan, ParamPlan } from "./plan.js";

type ParamPair = {
    paramPlan: ParamPlan | undefined;
    param: GlParam | undefined;
};

const paramPairAt = (plan: CommandPlan & { ok: true }, index: number): ParamPair => ({
    paramPlan: plan.params[index],
    param: plan.command.params[index],
});

export { paramPairAt };
