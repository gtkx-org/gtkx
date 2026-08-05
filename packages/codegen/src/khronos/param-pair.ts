import type { GlParam } from "./model.js";
import type { CommandPlan, ParamPlan } from "./plan.js";

type ParamPair = {
    paramPlan: ParamPlan | undefined;
    param: GlParam | undefined;
};

const paramPairAt = (plan: CommandPlan & { isOk: true }, index: number): ParamPair => ({
    paramPlan: plan.params[index],
    param: plan.command.params[index],
});

export { paramPairAt };
