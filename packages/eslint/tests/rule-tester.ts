import { RuleTester } from "@typescript-eslint/rule-tester";
import { afterAll, describe, it } from "vitest";

type Options = ConstructorParameters<typeof RuleTester>[0];

function createRuleTester(options?: Options): RuleTester {
    RuleTester.afterAll = afterAll;
    RuleTester.describe = describe;
    RuleTester.it = it;
    RuleTester.itOnly = it.only;

    return new RuleTester(options);
}

export { createRuleTester };
