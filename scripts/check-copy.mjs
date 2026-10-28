import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

for (const name of ["../index.html", "../guide/index.html"]) {
	const text = readFileSync(new URL(name, import.meta.url), "utf8")
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ");
	assert.doesNotMatch(
		text,
		/free installs record what it would|free: would have stopped|Pro names them/i,
		name,
	);
	assert.match(text, /grok-usage on/, name);
	assert.match(text, /15 minutes/, name);
	assert.match(text, /--host codex/, name);
}
console.log(
	"Current feature copy agrees on free controls, optional Grok usage, host selection and stale readings.",
);
