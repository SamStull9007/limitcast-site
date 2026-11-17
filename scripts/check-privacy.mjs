import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const root = new URL("../", import.meta.url);
const homepage = readFileSync(new URL("index.html", root), "utf8");
const guide = readFileSync(new URL("guide/index.html", root), "utf8");
// The canonical disclosure belongs to the separate product repository, not this site's PR.
const response = await fetch(
	"https://raw.githubusercontent.com/SamStull9007/limitcast/main/README.md",
	{ signal: AbortSignal.timeout(15000) },
);
assert.ok(
	response.ok,
	`Cannot verify source privacy disclosure: HTTP ${response.status}`,
);
const readme = await response.text();
const plain = (text) =>
	text
		.replace(/<[^>]*>/g, " ")
		.replace(/\s+/g, " ")
		.trim();

for (const [name, text] of [
	["homepage", homepage],
	["guide", guide],
	["README", readme],
]) {
	const content = name === "README" ? text.replace(/\s+/g, " ") : plain(text);
	assert.match(
		content,
		/optimizer model/i,
		`${name}: disclose optional optimizer calls`,
	);
	assert.match(
		content,
		/authenticated Codex CLI/,
		`${name}: disclose account use`,
	);
	assert.match(
		content,
		/consumes? your Codex allowance/,
		`${name}: disclose plan consumption`,
	);
	assert.match(
		content,
		/off by default/i,
		`${name}: preserve opt-in disclosure`,
	);
	assert.doesNotMatch(
		content,
		/one place limitcast uses a login|unless you turn on Grok's weekly usage/i,
	);
}
const intro = plain(
	homepage.match(/<p class="pro-note">([\s\S]*?)<\/p>/)?.[1] ?? "",
);
assert.match(intro, /Codex CLI and consume your Codex allowance/);

const schemas = [
	...homepage.matchAll(
		/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g,
	),
].map((m) => JSON.parse(m[1]));
const faq = schemas.find((schema) => schema["@type"] === "FAQPage");
assert.ok(faq, "Missing FAQ structured data");
for (const question of [
	"Does it send my code or prompts anywhere?",
	"Does it use my Claude login?",
]) {
	const answer = faq.mainEntity.find((item) => item.name === question)
		?.acceptedAnswer?.text;
	assert.ok(answer, `Missing FAQ answer: ${question}`);
	const details = [
		...homepage.matchAll(/<details>([\s\S]*?)<\/details>/g),
	].find((m) => m[1].includes(`<summary>${question}</summary>`));
	assert.ok(details, `Missing visible FAQ: ${question}`);
	assert.equal(
		plain(details[1].replace(/<summary>[\s\S]*?<\/summary>/, "")),
		plain(answer),
		`FAQ text and metadata differ: ${question}`,
	);
	assert.match(answer, /Codex/);
}
assert.match(
	plain(homepage),
	/Uses your logins Optional Grok usage and Codex model calls/,
);
console.log("Privacy disclosures match source and FAQ metadata.");
