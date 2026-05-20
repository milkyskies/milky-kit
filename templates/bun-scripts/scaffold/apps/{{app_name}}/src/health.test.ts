import { describe, expect, test } from "bun:test";

describe("health", () => {
	test("the test runtime works", () => {
		expect({ status: "ok" }.status).toBe("ok");
	});
});
