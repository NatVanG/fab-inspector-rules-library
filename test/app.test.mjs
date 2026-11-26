import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";

class Node {
  constructor(tag = "div") {
    this.tagName = tag;
    this.children = [];
    this.attributes = {};
    this.listeners = {};
    this.value = "";
    this.type = "";
    this.textContent = "";
    this.classList = {
      values: new Set(),
      contains: name => this.classList.values.has(name),
      toggle: (name, force) => {
        const enabled = force ?? !this.classList.values.has(name);
        if (enabled) this.classList.values.add(name);
        else this.classList.values.delete(name);
      },
    };
  }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this.children = children; }
  insertBefore(child, before) { this.children.splice(this.children.indexOf(before), 0, child); }
  setAttribute(name, value) { this.attributes[name] = value; }
  addEventListener(name, callback) { this.listeners[name] = callback; }
  add(option) { this.children.push(option); }
  dispatch(name) { this.listeners[name]?.(); }
}

async function app() {
  const nodes = new Map();
  const document = {
    documentElement: new Node(),
    createElement: tag => new Node(tag),
    createTextNode: text => ({ textContent: text }),
    querySelector: selector => {
      if (!nodes.has(selector)) nodes.set(selector, new Node());
      return nodes.get(selector);
    },
  };
  for (const selector of ["#search", "#tags"]) document.querySelector(selector).type = "search";
  document.querySelector("#sort").value = "name";
  document.querySelector("#url-mode").options = [new Node("option")];
  const sets = Array.from({ length: 14 }, (_, index) => ({
    path: `${index}.json`,
    name: `Set ${String(index).padStart(2, "0")}`,
    description: "",
    rules: [{ id: `rule-${index}`, name: `Rule ${index}`, itemType: "Report", tags: ["sample"] }],
  }));
  const source = (await readFile(new URL("../web/app.js", import.meta.url), "utf8"))
    .replace(/^import .*;\n/, "");
  runInNewContext(source, {
    document,
    fetch: async () => ({ ok: true, json: async () => ({
      rulesets: sets,
      source: { repository: "owner/repo", headRef: "main", commitSha: "a".repeat(40) },
    }) }),
    Option: class { constructor(text, value) { this.text = text; this.value = value; } },
    ruleKey: (path, index) => JSON.stringify([path, index]),
    setTimeout,
  });
  await new Promise(resolve => setImmediate(resolve));
  return document.querySelector;
}

test("pagination and layouts preserve selections and reset when filters change", async () => {
  const $ = await app();
  assert.equal($("#results").children.length, 12);
  assert.equal($("#page-summary").textContent, "Page 1 of 2");
  assert.equal($("#previous-page").disabled, true);

  const checkbox = $("#results").children[0].children[0].children[0].children[0];
  checkbox.checked = true;
  checkbox.dispatch("change");
  $("#next-page").dispatch("click");
  assert.equal($("#results").children.length, 2);
  assert.equal($("#next-page").disabled, true);
  $("#list-layout").dispatch("click");
  assert.equal($("#results").classList.contains("list-view"), true);
  assert.equal($("#page-summary").textContent, "Page 2 of 2");
  assert.equal($("#selection-summary").textContent, "1 ruleset selected");
  $("#previous-page").dispatch("click");
  assert.equal($("#results").children[0].children[0].children[0].children[0].checked, true);

  $("#rules-view").dispatch("click");
  const ruleCheckbox = $("#results").children[0].children[1].children[0];
  ruleCheckbox.checked = true;
  ruleCheckbox.dispatch("change");
  $("#next-page").dispatch("click");
  assert.equal($("#results").children.length, 2);
  $("#previous-page").dispatch("click");
  assert.equal($("#results").children[0].children[1].children[0].checked, true);
  $("#next-page").dispatch("click");
  $("#tags").value = "missing";
  $("#tags").dispatch("input");
  assert.equal($("#results-summary").textContent, "0 rules found");
  assert.equal($("#pagination").hidden, true);
  $("#reset").dispatch("click");
  assert.equal($("#page-summary").textContent, "Page 1 of 2");
  assert.equal($("#results").children.length, 12);
  assert.equal($("#rule-selection-summary").textContent, "1 rule selected");
  $("#rulesets-view").dispatch("click");
  assert.equal($("#page-summary").textContent, "Page 1 of 2");
});
