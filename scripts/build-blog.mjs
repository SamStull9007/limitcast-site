// Rebuilds the post list and Blog structured data in blog/index.html, and the blog entries in sitemap.xml, from blog/*/index.html.
// Run after adding or editing a post. `--check` writes nothing and exits 1 if they are stale.
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const site = "https://limitcast.dev";

/** @param {string} html @param {RegExp} re @param {string} slug @param {string} what */
function need(html, re, slug, what) {
	const m = html.match(re);
	if (!m) throw new Error(`blog/${slug}/index.html: missing ${what}`);
	return m[1];
}

// Post pages carry HTML-escaped text; JSON-LD needs it plain.
const plain = (s) =>
	s
		.replaceAll("&lt;", "<")
		.replaceAll("&gt;", ">")
		.replaceAll("&quot;", '"')
		.replaceAll("&#39;", "'")
		.replaceAll("&amp;", "&");

const posts = readdirSync(join(root, "blog"), { withFileTypes: true })
	.filter(
		(d) =>
			d.isDirectory() && existsSync(join(root, "blog", d.name, "index.html")),
	)
	.map(({ name: slug }) => {
		const html = readFileSync(join(root, "blog", slug, "index.html"), "utf8");
		const published = need(
			html,
			/property="article:published_time"\s+content="(\d{4}-\d{2}-\d{2})"/,
			slug,
			"article:published_time (YYYY-MM-DD)",
		);
		const modified =
			html.match(
				/property="article:modified_time"\s+content="(\d{4}-\d{2}-\d{2})"/,
			)?.[1] ?? published;
		return {
			slug,
			title: need(html, /<title>([^<]+)<\/title>/, slug, "<title>"),
			description: need(
				html,
				/<meta\s+name="description"\s+content="([^"]+)"/,
				slug,
				"meta description",
			),
			published,
			modified,
		};
	})
	.sort(
		(a, b) =>
			b.published.localeCompare(a.published) || a.slug.localeCompare(b.slug),
	);

if (!posts.length) throw new Error("no posts found under blog/");

const day = (iso) =>
	new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-GB", {
		day: "numeric",
		month: "long",
		year: "numeric",
		timeZone: "UTC",
	});

/** @param {string} text @param {RegExp} re @param {string} to @param {string} file */
function swap(text, re, to, file) {
	if (!re.test(text)) throw new Error(`${file}: anchor not found: ${re}`);
	return text.replace(re, () => to);
}

const items = posts
	.map(
		(p) => `\t\t\t\t\t<li>
\t\t\t\t\t\t<time datetime="${p.published}">${day(p.published)}</time>
\t\t\t\t\t\t<h2><a href="/blog/${p.slug}/">${p.title}</a></h2>
\t\t\t\t\t\t<p>${p.description}</p>
\t\t\t\t\t</li>`,
	)
	.join("\n");

const ld = JSON.stringify(
	posts.map((p) => ({
		"@type": "BlogPosting",
		headline: plain(p.title),
		datePublished: p.published,
		url: `${site}/blog/${p.slug}/`,
	})),
);

let index = readFileSync(join(root, "blog", "index.html"), "utf8");
index = swap(
	index,
	/<ul class="posts">[\s\S]*?<\/ul>/,
	`<ul class="posts">\n${items}\n\t\t\t\t</ul>`,
	"blog/index.html",
);
index = swap(
	index,
	/"blogPost": \[[\s\S]*?\}\s*\]/,
	`"blogPost": ${ld}`,
	"blog/index.html",
);

const newest = posts.reduce((m, p) => (p.modified > m ? p.modified : m), "");
const entry = (path, lastmod) =>
	`  <url><loc>${site}${path}</loc><lastmod>${lastmod}</lastmod></url>`;
let map = readFileSync(join(root, "sitemap.xml"), "utf8")
	.split("\n")
	.filter((l) => !l.includes(`<loc>${site}/blog/`))
	.join("\n");
map = swap(
	map,
	/<\/urlset>/,
	`${[entry("/blog/", newest), ...posts.map((p) => entry(`/blog/${p.slug}/`, p.modified))].join("\n")}\n</urlset>`,
	"sitemap.xml",
);

const outputs = { "blog/index.html": index, "sitemap.xml": map };
const stale = Object.entries(outputs).filter(
	([f, text]) => readFileSync(join(root, f), "utf8") !== text,
);

if (process.argv.includes("--check")) {
	if (stale.length) {
		console.error(
			`stale: ${stale.map(([f]) => f).join(", ")} (run node scripts/build-blog.mjs)`,
		);
		process.exit(1);
	}
	console.log(`ok: ${posts.length} posts listed`);
} else {
	for (const [f, text] of stale) writeFileSync(join(root, f), text);
	console.log(
		`${posts.length} posts; updated: ${stale.map(([f]) => f).join(", ") || "nothing"}`,
	);
}
