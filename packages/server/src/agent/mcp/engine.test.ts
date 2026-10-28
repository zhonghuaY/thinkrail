import { expect, test } from "bun:test";
import type {
	ExtensionAPI,
	InlineExtension,
	ToolDefinition,
} from "@earendil-works/pi-coding-agent";
import { createMcpEngine } from "./engine";

interface RegisteredTool {
	name: string;
	defaultActive: boolean | undefined;
	definition: ToolDefinition;
}

function loadCodemodeTool(): {
	descriptor: InlineExtension;
	tool: RegisteredTool;
	context: Record<string, unknown>;
} {
	const engine = createMcpEngine({ loadConfig: () => ({ servers: [], errors: [] }) });
	const descriptor = engine.extensions.find(
		(extension) => "name" in extension && extension.name === "codemode",
	);
	if (!descriptor) {
		throw new Error(
			`the engine registers ${engine.extensions.map((extension) => ("name" in extension ? extension.name : "<bare factory>")).join(", ")}; codemode is missing`,
		);
	}
	if (!("factory" in descriptor)) throw new Error("the codemode descriptor carries no factory");
	const registered: RegisteredTool[] = [];
	const context: Record<string, unknown> = {};
	const api = {
		registerTool: (definition: ToolDefinition) => {
			registered.push({
				name: definition.name,
				defaultActive: definition.defaultActive,
				definition,
			});
		},
		tools: [],
		sessionManager: { getBranch: () => [] },
		getAllTools: () => [],
		appendEntry: () => {},
	} as unknown as ExtensionAPI;
	descriptor.factory(api);
	const tool = registered.find((entry) => entry.name === "codemode");
	if (!tool) {
		throw new Error(
			`the factory registered ${registered.map((entry) => entry.name).join(", ")} instead of codemode`,
		);
	}
	return { descriptor, tool, context };
}

test("the engine registers pi's codemode built-in inactive, like pi's CLI", () => {
	const { descriptor, tool } = loadCodemodeTool();
	if (!("builtin" in descriptor)) throw new Error("codemode is not marked builtin");
	expect(descriptor.builtin).toBe(true);
	if (!("replaceable" in descriptor)) throw new Error("codemode is not marked replaceable");
	expect(descriptor.replaceable).toBe(true);
	expect(tool.defaultActive).toBe(false);
});

test("the registered codemode tool runs a script in the QuickJS sandbox", async () => {
	const { tool } = loadCodemodeTool();
	const result = await tool.definition.execute(
		"test",
		{ code: "return 6*7;" },
		undefined,
		undefined,
		{ tools: [], sessionManager: { getBranch: () => [] } } as never,
	);
	const text = JSON.stringify(result);
	expect(text).toContain("Script completed");
	expect(text).toContain("42");
}, 30000);
