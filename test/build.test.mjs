import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, writeFile, readFile, rm, cp } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { runInNewContext } from "node:vm";
import { build, collectRulesets } from "../scripts/build.mjs";
import { createCatalog, rulesetURL } from "../web/catalog.js";

const sourceMetadata = {
  repository: "NatVanG/fab-inspector-rules-library",
  headRef: "main",
  commitSha: "1234567890abcdef1234567890abcdef12345678",
};

async function fixture(t) {
  const root = await mkdtemp(path.join(os.tmpdir(), "fab-library-"));
  t.after(() => rm(root, { recursive: true, force: true }));
  await mkdir(path.join(root, "rulesets"));
  return root;
}

test("embed query parameter enables the embed layout only for true", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  for (const [search, expected] of [
    ["", false],
    ["?embed=true", true],
    ["?other=value&embed=true", true],
    ["?embed=false", false],
    ["?embed", false],
    ["?other=true", false],
  ]) {
    const classes = new Set();
    runInNewContext(script, {
      URLSearchParams,
      location: { search },
      document: { documentElement: { classList: classes } },
    });
    assert.equal(classes.has("embed-mode"), expected, search);
  }
});

test("dark theme query parameter works independently and with embed mode", async () => {
  const html = await readFile(new URL("../web/index.html", import.meta.url), "utf8");
  const script = html.match(/<script>([\s\S]*?)<\/script>/)?.[1];
  assert.ok(script);
  for (const [search, dark, embed] of [
    ["", false, false],
    ["?theme=dark", true, false],
    ["?embed=true&theme=dark", true, true],
    ["?theme=light&embed=true", false, true],
    ["?theme=true", false, false],
  ]) {
    const classes = new Set();
    runInNewContext(script, {
      URLSearchParams,
      location: { search },
      document: { documentElement: { classList: classes } },
    });
    assert.equal(classes.has("dark-mode"), dark, search);
    assert.equal(classes.has("embed-mode"), embed, search);
  }
});

test("build discovers nested rulesets and preserves original downloads and unknown fields", async t => {
  const root = await fixture(t);
  await cp(new URL("../web", import.meta.url), path.join(root, "web"), { recursive: true });
  await mkdir(path.join(root, "rulesets", "Fabric checks"));
  const document = {
    name: "Lakehouse checks",
    description: "Reusable checks",
    customMetadata: { version: 1 },
    rules: [
      { id: "CHECK", name: "A check", itemType: "Lakehouse", disabled: true, test: [{ var: "mode" }, "Batch"], custom: 42 },
      { name: "<script>unsafe</script>", itemType: ["Report", "SemanticModel"], test: [true, true] },
    ],
  };
  const source = JSON.stringify(document, null, 4);
  const relative = "Fabric checks/Checks #1.JSON";
  await writeFile(path.join(root, "rulesets", relative), source);
  await writeFile(path.join(root, "rulesets", "notes.txt"), "Not a ruleset");
  const sets = await build(root, sourceMetadata);
  assert.equal(sets.length, 1);
  assert.equal(sets[0].path, relative);
  assert.equal(sets[0].name, document.name);
  assert.deepEqual(sets[0].rules, document.rules);
  assert.equal(await readFile(path.join(root, "dist", "rulesets", relative), "utf8"), source);
  const catalog = JSON.parse(await readFile(path.join(root, "dist", "catalog.json"), "utf8"));
  assert.deepEqual(catalog.rulesets, sets);
  assert.deepEqual(catalog.source, sourceMetadata);
  assert.equal(await readFile(path.join(root, "dist", "catalog.js"), "utf8"),
    await readFile(path.join(root, "web", "catalog.js"), "utf8"));
  assert.match(await readFile(path.join(root, "dist", "index.html"), "utf8"), /src="\.\/app\.js\?v=[a-f0-9]{16}"/);
  for (const asset of ["fab-inspector.png", "microsoft-fabric.svg", "NOTICE.txt"]) {
    assert.deepEqual(
      await readFile(path.join(root, "dist", "assets", asset)),
      await readFile(path.join(root, "web", "assets", asset)),
    );
  }
  await rm(path.join(root, "rulesets", relative));
  await build(root, sourceMetadata);
  await assert.rejects(readFile(path.join(root, "dist", "rulesets", relative)), { code: "ENOENT" });
});

test("ruleset URLs use branch head or the full commit SHA and encode nested paths", () => {
  const set = { path: "Fabric checks/Checks #1.JSON" };
  const base = "https://raw.githubusercontent.com/NatVanG/fab-inspector-rules-library";
  assert.equal(rulesetURL(set, sourceMetadata, "head"),
    `${base}/main/rulesets/Fabric%20checks/Checks%20%231.JSON`);
  assert.equal(rulesetURL(set, sourceMetadata, "commit"),
    `${base}/${sourceMetadata.commitSha}/rulesets/Fabric%20checks/Checks%20%231.JSON`);
});

test("build invalidates cached client assets when scripts or styles change", async t => {
  const root = await fixture(t);
  await cp(new URL("../web", import.meta.url), path.join(root, "web"), { recursive: true });
  async function assetURLs() {
    await build(root, sourceMetadata);
    const html = await readFile(path.join(root, "dist", "index.html"), "utf8");
    const app = await readFile(path.join(root, "dist", "app.js"), "utf8");
    return {
      app: html.match(/src="(\.\/app\.js\?v=[a-f0-9]{16})"/)?.[1],
      styles: html.match(/href="(\.\/styles\.css\?v=[a-f0-9]{16})"/)?.[1],
      catalog: app.match(/from "(\.\/catalog\.js\?v=[a-f0-9]{16})"/)?.[1],
    };
  }
  const original = await assetURLs();
  for (const url of Object.values(original)) assert.ok(url);
  assert.deepEqual(await assetURLs(), original);

  const appPath = path.join(root, "web", "app.js");
  await writeFile(appPath, `${await readFile(appPath, "utf8")}\n`);
  const changedApp = await assetURLs();
  assert.notEqual(changedApp.app, original.app);
  assert.equal(changedApp.catalog, original.catalog);
  assert.equal(changedApp.styles, original.styles);

  const catalogPath = path.join(root, "web", "catalog.js");
  await writeFile(catalogPath, `${await readFile(catalogPath, "utf8")}\n`);
  const changedCatalog = await assetURLs();
  assert.notEqual(changedCatalog.catalog, changedApp.catalog);
  assert.notEqual(changedCatalog.app, changedApp.app);

  const stylesPath = path.join(root, "web", "styles.css");
  await writeFile(stylesPath, `${await readFile(stylesPath, "utf8")}\n`);
  const changedStyles = await assetURLs();
  assert.notEqual(changedStyles.styles, changedCatalog.styles);
  assert.equal(changedStyles.app, changedCatalog.app);
});

test("catalog exports only selected complete rulesets in Fab Inspector's format", () => {
  const sets = [
    { path: "one.json", name: "First", rules: [{ id: "ONE" }, { id: "TWO", disabled: true }] },
    { path: "two.json", name: "Second", rules: [] },
    { path: "nested/three.json", name: "Third", rules: [{ id: "THREE" }] },
  ];
  const selected = new Set(["nested/three.json", "one.json"]);
  const catalog = createCatalog(sets, selected, sourceMetadata, "commit", " My checks ");
  assert.deepEqual(catalog, {
    name: "My checks",
    ruleSets: [
      { name: "First", type: "url", path: `https://raw.githubusercontent.com/${sourceMetadata.repository}/${sourceMetadata.commitSha}/rulesets/one.json` },
      { name: "Third", type: "url", path: `https://raw.githubusercontent.com/${sourceMetadata.repository}/${sourceMetadata.commitSha}/rulesets/nested/three.json` },
    ],
  });
  assert.equal(createCatalog(sets, selected, sourceMetadata, "head", " ").name, "Fab Inspector Rules Catalog");
  assert.deepEqual(createCatalog(sets, new Set(), sourceMetadata, "head", "").ruleSets, []);
});

test("empty collection builds without sample data", async t => {
  const root = await fixture(t);
  assert.deepEqual(await collectRulesets(path.join(root, "rulesets")), []);
});

test("filename supplies a readable name when optional metadata is absent", async t => {
  const root = await fixture(t);
  await writeFile(path.join(root, "rulesets", "Report_checks.json"), '{"rules":[]}');
  const [set] = await collectRulesets(path.join(root, "rulesets"));
  assert.equal(set.name, "Report checks");
});

test("invalid JSON and invalid ruleset shapes fail with the source path", async t => {
  const root = await fixture(t);
  const file = path.join(root, "rulesets", "bad.json");
  for (const source of ["{", "null", "[]", "{}", '{"rules":[null]}', '{"rules":[[]]}', '{"rules":["rule"]}']) {
    await writeFile(file, source);
    await assert.rejects(collectRulesets(path.join(root, "rulesets")), /bad\.json: (invalid JSON|expected an object)/);
  }
});
