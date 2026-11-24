import { readdir, readFile, mkdir, writeFile, copyFile, cp, rm } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";

function assetVersion(content) {
  return createHash("sha256").update(content).digest("hex").slice(0, 16);
}

export async function collectRulesets(directory, prefix = "") {
  const entries = await readdir(directory, { withFileTypes: true });
  const rulesets = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name, "en"))) {
    const relativePath = prefix ? `${prefix}/${entry.name}` : entry.name;
    const fullPath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      rulesets.push(...await collectRulesets(fullPath, relativePath));
    } else if (entry.isFile() && /\.json$/i.test(entry.name)) {
      const source = await readFile(fullPath, "utf8");
      let document;
      try {
        document = JSON.parse(source);
      } catch (error) {
        throw new Error(`${relativePath}: invalid JSON: ${error.message}`, { cause: error });
      }
      if (!document || Array.isArray(document) || !Array.isArray(document.rules)
          || document.rules.some(rule => !rule || typeof rule !== "object" || Array.isArray(rule))) {
        throw new Error(`${relativePath}: expected an object with a "rules" array of rule objects`);
      }
      rulesets.push({
        path: relativePath,
        name: typeof document.name === "string" && document.name.trim()
          ? document.name : entry.name.replace(/\.json$/i, "").replace(/[-_]/g, " "),
        description: typeof document.description === "string" ? document.description : "",
        rules: document.rules,
      });
    }
  }
  return rulesets;
}

export async function build(root, {
  repository = process.env.GITHUB_REPOSITORY || "NatVanG/fab-inspector-rules-library",
  headRef = "main",
  commitSha = process.env.GITHUB_SHA || execFileSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).trim(),
} = {}) {
  if (!/^[a-zA-Z0-9_.-]+\/[a-zA-Z0-9_.-]+$/.test(repository)
      || !headRef || !/^[a-f0-9]{40}$/i.test(commitSha)) {
    throw new Error("Invalid repository, head reference, or commit SHA for ruleset URLs");
  }
  const source = path.join(root, "rulesets");
  const rulesets = await collectRulesets(source);
  const output = path.join(root, "dist");
  await rm(output, { recursive: true, force: true });
  await mkdir(output, { recursive: true });
  const [html, styles, app, catalogModule] = await Promise.all(
    ["index.html", "styles.css", "app.js", "catalog.js"]
      .map(file => readFile(path.join(root, "web", file), "utf8")),
  );
  const versionedApp = app.replace('"./catalog.js"', `"./catalog.js?v=${assetVersion(catalogModule)}"`);
  const versionedHTML = html
    .replace('href="./styles.css"', `href="./styles.css?v=${assetVersion(styles)}"`)
    .replace('src="./app.js"', `src="./app.js?v=${assetVersion(versionedApp)}"`);
  for (const [file, content] of [
    ["index.html", versionedHTML], ["styles.css", styles],
    ["app.js", versionedApp], ["catalog.js", catalogModule],
  ]) {
    await writeFile(path.join(output, file), content);
  }
  await cp(path.join(root, "web", "assets"), path.join(output, "assets"), { recursive: true });
  for (const ruleset of rulesets) {
    const target = path.join(output, "rulesets", ruleset.path);
    await mkdir(path.dirname(target), { recursive: true });
    await copyFile(path.join(source, ruleset.path), target);
  }
  const catalog = { source: { repository, headRef, commitSha }, rulesets };
  await writeFile(path.join(output, "catalog.json"), `${JSON.stringify(catalog, null, 2)}\n`);
  return rulesets;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const root = fileURLToPath(new URL("../", import.meta.url));
  const rulesets = await build(root);
  console.log(`Built ${rulesets.length} rulesets with ${rulesets.reduce((sum, set) => sum + set.rules.length, 0)} rules.`);
}
