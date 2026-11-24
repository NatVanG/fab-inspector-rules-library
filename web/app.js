const $ = selector => document.querySelector(selector);
const state = { rulesets: [], view: "rules", ready: false };
const controls = ["#search", "#item-type", "#ruleset", "#status", "#sort"];
let activePreview;
let returnFocus;
let previewVersion = 0;

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function ruleName(rule, index) {
  return typeof rule.name === "string" && rule.name ? rule.name
    : typeof rule.id === "string" && rule.id ? rule.id : `Rule ${index + 1}`;
}

function itemTypes(rule) {
  const values = Array.isArray(rule.itemType) ? rule.itemType : [rule.itemType];
  return values.filter(value => typeof value === "string" && value);
}

function tags(values) {
  const container = element("div", "tags");
  for (const value of values) container.append(element("span", "tag", value));
  return container;
}

function sourceURL(set) {
  return `./rulesets/${set.path.split("/").map(encodeURIComponent).join("/")}`;
}

function downloadRule(rule) {
  const blob = new Blob([`${JSON.stringify({ rules: [rule] }, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  const name = typeof rule.id === "string" ? rule.id : "rule";
  link.download = `${name.replace(/[^a-zA-Z0-9._-]/g, "_") || "rule"}.json`;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadSet(set) {
  const link = element("a");
  link.href = sourceURL(set);
  link.download = set.path.split("/").at(-1);
  document.body.append(link);
  link.click();
  link.remove();
}

async function preview(entry) {
  const version = ++previewVersion;
  returnFocus = document.activeElement;
  activePreview = null;
  $("#detail-download").disabled = true;
  $("#copy").disabled = true;
  $("#copy-status").textContent = "";
  const isRule = Boolean(entry.rule);
  $("#detail-kind").textContent = isRule ? "RULE PREVIEW" : "RULESET PREVIEW";
  $("#detail-title").textContent = entry.name;
  $("#detail-description").textContent = isRule ? entry.rule.description || "" : entry.set.description;
  $("#detail-meta").replaceChildren(tags(isRule
    ? [...itemTypes(entry.rule), entry.rule.disabled === true ? "Disabled" : "Enabled", entry.set.name]
    : [`${entry.set.rules.length} rules`, entry.set.path]));
  $("#detail-note").textContent = isRule ? "Downloads as a ruleset containing this rule." : "Downloads the original, complete ruleset.";
  $("#detail-json").textContent = "Loading JSON...";
  $("#detail").showModal();
  try {
    let json;
    if (isRule) {
      json = JSON.stringify({ rules: [entry.rule] }, null, 2);
    } else {
      const response = await fetch(sourceURL(entry.set));
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      json = await response.text();
    }
    if (!$("#detail").open || version !== previewVersion) return;
    activePreview = { entry, json };
    $("#detail-json").textContent = json;
    $("#detail-download").disabled = false;
    $("#copy").disabled = false;
  } catch (error) {
    if ($("#detail").open && version === previewVersion) {
      $("#detail-json").textContent = `Unable to load this ruleset: ${error.message}. Close this preview and try again.`;
    }
  }
}

function card(entry) {
  const article = element("article", "card");
  const top = element("div", "card-top");
  top.append(tags(entry.rule ? itemTypes(entry.rule) : ["RULESET"]));
  if (entry.rule?.disabled === true) top.append(element("span", "disabled-label", "Disabled"));
  if (!entry.rule) top.append(element("span", "rule-total", `${entry.set.rules.length} rules`));
  const title = element("h3");
  const open = element("button", "title-button", entry.name);
  open.type = "button";
  open.addEventListener("click", () => preview(entry));
  title.append(open);
  const description = entry.rule ? entry.rule.description : entry.set.description;
  const source = element("p", "card-source", entry.rule ? entry.set.name : entry.set.path);
  source.title = entry.set.path;
  const id = element("p", "rule-id", entry.rule?.id ? String(entry.rule.id) : entry.set.path);
  const actions = element("div", "card-actions");
  const inspect = element("button", "text-button", "View JSON");
  inspect.type = "button";
  inspect.addEventListener("click", () => preview(entry));
  const download = element("button", "download-button", "Download \u2193");
  download.type = "button";
  download.setAttribute("aria-label", `Download ${entry.name}`);
  download.addEventListener("click", () => entry.rule ? downloadRule(entry.rule) : downloadSet(entry.set));
  actions.append(inspect, download);
  article.append(top, title, id, element("p", "card-description", typeof description === "string" && description ? description : "Inspect the JSON to explore this check and its configuration."), source, actions);
  return article;
}

function render() {
  if (!state.ready) return;
  const query = $("#search").value.trim().toLocaleLowerCase();
  const type = $("#item-type").value;
  const selectedSet = $("#ruleset").value;
  const status = $("#status").value;
  const matchesRule = rule => (!type || itemTypes(rule).includes(type))
    && (!status || (rule.disabled === true ? "disabled" : "enabled") === status);
  const matchesSearch = value => JSON.stringify(value).toLocaleLowerCase().includes(query);
  let entries = [];
  for (const set of state.rulesets) {
    if (selectedSet && set.path !== selectedSet) continue;
    if (state.view === "rulesets") {
      if ((!type && !status || set.rules.some(matchesRule)) && matchesSearch(set)) {
        entries.push({ set, name: set.name });
      }
    } else {
      set.rules.forEach((rule, index) => {
        if (matchesRule(rule) && matchesSearch([rule, set.name, set.description, set.path])) {
          entries.push({ set, rule, name: ruleName(rule, index) });
        }
      });
    }
  }
  if ($("#sort").value === "name") entries.sort((a, b) => a.name.localeCompare(b.name));
  $("#rules-view").setAttribute("aria-pressed", String(state.view === "rules"));
  $("#rulesets-view").setAttribute("aria-pressed", String(state.view === "rulesets"));
  const unit = state.view === "rules" ? "rule" : "ruleset";
  $("#results-summary").textContent = `${entries.length} ${unit}${entries.length === 1 ? "" : "s"} found`;
  const results = $("#results");
  results.replaceChildren();
  if (entries.length) {
    results.append(...entries.map(card));
  } else {
    const empty = element("div", "empty-state");
    const hasFilters = Boolean(query || type || selectedSet || status);
    empty.append(element("span", "empty-icon", "{ }"), element("h3", "", hasFilters ? "No matches this time" : "Your next great check starts here"),
      element("p", "", hasFilters ? "Try a different search or reset your filters." : "There are no entries in this collection yet. Add a JSON ruleset to /rulesets to share it here."));
    results.append(empty);
  }
}

for (const selector of controls) $(selector).addEventListener(selector === "#search" ? "input" : "change", render);
$("#reset").addEventListener("click", () => {
  for (const selector of controls) $(selector).value = selector === "#sort" ? "name" : "";
  render();
});
for (const view of ["rules", "rulesets"]) $(`#${view}-view`).addEventListener("click", () => {
  state.view = view;
  render();
});
$("#close-detail").addEventListener("click", () => $("#detail").close());
$("#detail").addEventListener("close", () => {
  if ($("#detail").open) return;
  previewVersion++;
  activePreview = null;
  returnFocus?.focus();
});
$("#detail-download").addEventListener("click", () => {
  if (!activePreview) return;
  const { entry } = activePreview;
  if (entry.rule) downloadRule(entry.rule);
  else downloadSet(entry.set);
});
$("#copy").addEventListener("click", async () => {
  if (!activePreview) return;
  try {
    await navigator.clipboard.writeText(activePreview.json);
    $("#copy-status").textContent = "JSON copied to clipboard.";
  } catch {
    $("#copy-status").textContent = "Clipboard access failed. Select and copy the JSON preview instead.";
  }
});

async function load() {
  try {
    const response = await fetch("./catalog.json");
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const catalog = await response.json();
    if (!Array.isArray(catalog.rulesets)) throw new Error("Invalid catalog format");
    state.rulesets = catalog.rulesets;
    const ruleCount = state.rulesets.reduce((sum, set) => sum + set.rules.length, 0);
    $("#rule-count").textContent = ruleCount;
    $("#ruleset-count").textContent = state.rulesets.length;
    $("#catalog-summary").textContent = `${ruleCount} rules / ${state.rulesets.length} rulesets`;
    const types = [...new Set(state.rulesets.flatMap(set => set.rules.flatMap(itemTypes)))].sort();
    for (const type of types) $("#item-type").add(new Option(type, type));
    for (const set of state.rulesets) $("#ruleset").add(new Option(set.name, set.path));
    state.ready = true;
    render();
  } catch (error) {
    $("#catalog-summary").textContent = "Collection unavailable";
    $("#results-summary").textContent = "Unable to load the library";
    const message = element("div", "empty-state");
    message.append(element("h3", "", "The collection couldn't be loaded"), element("p", "", `${error.message}. Reload the page to try again.`));
    $("#results").replaceChildren(message);
  } finally {
    $("#results").setAttribute("aria-busy", "false");
  }
}

load();
