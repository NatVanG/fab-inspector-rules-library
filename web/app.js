import { rulesetURL, createCatalog, createRuleset, ruleKey } from "./catalog.js";

const $ = selector => document.querySelector(selector);
const state = { rulesets: [], selected: new Set(), selectedRules: new Set(), source: null, view: "rulesets", layout: "cards", pages: { rulesets: 1, rules: 1 }, ready: false };
const controls = ["#search", "#item-type", "#ruleset", "#tags", "#sort"];
const pageSize = 12;
let activePreview;
let returnFocus;
let previewVersion = 0;

const themeToggle = $("#theme-toggle");
function updateThemeToggle() {
  themeToggle.setAttribute("aria-pressed", String(document.documentElement.classList.contains("dark-mode")));
}
updateThemeToggle();
themeToggle.addEventListener("click", () => {
  document.documentElement.classList.toggle("dark-mode");
  updateThemeToggle();
});

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

function downloadJSON(data, filename) {
  const blob = new Blob([`${JSON.stringify(data, null, 2)}\n`], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = element("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function downloadRule(rule) {
  const name = typeof rule.id === "string" ? rule.id : "rule";
  downloadJSON({ rules: [rule] }, `${name.replace(/[^a-zA-Z0-9._-]/g, "_") || "rule"}.json`);
}

function updateSelection() {
  const count = state.selected.size;
  $("#selection-summary").textContent = `${count} ruleset${count === 1 ? "" : "s"} selected`;
  $("#download-catalog").disabled = count === 0;
  $("#clear-selection").disabled = count === 0;
  const ruleCount = state.selectedRules.size;
  $("#rule-selection-summary").textContent = `${ruleCount} rule${ruleCount === 1 ? "" : "s"} selected`;
  $("#download-ruleset").disabled = ruleCount === 0;
  $("#clear-rules").disabled = ruleCount === 0;
}

async function copyURL(set) {
  const url = rulesetURL(set, state.source, $("#url-mode").value);
  $("#url-fallback").hidden = true;
  try {
    await navigator.clipboard.writeText(url);
    $("#url-status").textContent = `URL copied for ${set.name}.`;
  } catch {
    $("#url-status").textContent = "Clipboard access failed. Copy the URL below instead.";
    $("#failed-url").value = url;
    $("#url-fallback").hidden = false;
    $("#failed-url").focus();
    $("#failed-url").select();
  }
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
  if (!entry.rule) {
    const selection = element("label", "ruleset-selection");
    const checkbox = element("input");
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Include ${entry.name} (${entry.set.path}) in catalog`);
    checkbox.checked = state.selected.has(entry.set.path);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selected.add(entry.set.path);
      else state.selected.delete(entry.set.path);
      updateSelection();
    });
    selection.append(checkbox, document.createTextNode("Include in catalog"));
    selection.title = `Include ${entry.name} (${entry.set.path}) in catalog`;
    top.replaceChildren(selection, element("span", "rule-total", `${entry.set.rules.length} rules`));
    const copy = element("button", "text-button", "Copy URL");
    copy.type = "button";
    copy.setAttribute("aria-label", `Copy URL for ${entry.name}`);
    copy.addEventListener("click", () => copyURL(entry.set));
    actions.insertBefore(copy, download);
  }
  article.append(top);
  if (entry.rule) {
    const selection = element("label", "ruleset-selection rule-selection");
    const checkbox = element("input");
    const key = ruleKey(entry.set.path, entry.index);
    checkbox.type = "checkbox";
    checkbox.setAttribute("aria-label", `Include ${entry.name} (${entry.set.path}, rule ${entry.index + 1}) in ruleset`);
    checkbox.checked = state.selectedRules.has(key);
    checkbox.addEventListener("change", () => {
      if (checkbox.checked) state.selectedRules.add(key);
      else state.selectedRules.delete(key);
      updateSelection();
    });
    selection.append(checkbox, document.createTextNode("Include in ruleset"));
    article.append(selection);
  }
  article.append(title, id, element("p", "card-description", typeof description === "string" && description ? description : "Inspect the JSON to explore this check and its configuration."), source, actions);
  return article;
}

function render() {
  if (!state.ready) return;
  const query = $("#search").value.trim().toLocaleLowerCase();
  const type = $("#item-type").value;
  const selectedSet = $("#ruleset").value;
  const tagQuery = $("#tags").value.trim().toLocaleLowerCase();
  const matchesRule = rule => (!type || itemTypes(rule).includes(type))
    && (!tagQuery || Array.isArray(rule.tags)
      && rule.tags.some(tag => typeof tag === "string" && tag.toLocaleLowerCase().includes(tagQuery)));
  const matchesSearch = value => JSON.stringify(value).toLocaleLowerCase().includes(query);
  const rules = [];
  const rulesets = [];
  for (const set of state.rulesets) {
    if (selectedSet && set.path !== selectedSet) continue;
    if ((!type && !tagQuery || set.rules.some(matchesRule)) && matchesSearch(set)) {
      rulesets.push({ set, name: set.name });
    }
    set.rules.forEach((rule, index) => {
      if (matchesRule(rule) && matchesSearch([rule, set.name, set.description, set.path])) {
        rules.push({ set, rule, index, name: ruleName(rule, index) });
      }
    });
  }
  $("#rule-count").textContent = rules.length;
  $("#ruleset-count").textContent = rulesets.length;
  const entries = state.view === "rules" ? rules : rulesets;
  if ($("#sort").value === "name") entries.sort((a, b) => a.name.localeCompare(b.name));
  $("#rules-view").setAttribute("aria-pressed", String(state.view === "rules"));
  $("#rulesets-view").setAttribute("aria-pressed", String(state.view === "rulesets"));
  $("#catalog-builder").hidden = state.view !== "rulesets";
  $("#ruleset-builder").hidden = state.view !== "rules";
  const unit = state.view === "rules" ? "rule" : "ruleset";
  const pageCount = Math.max(1, Math.ceil(entries.length / pageSize));
  state.pages[state.view] = Math.min(state.pages[state.view], pageCount);
  const page = state.pages[state.view];
  const start = (page - 1) * pageSize;
  $("#results-summary").textContent = entries.length
    ? `Showing ${start + 1}-${Math.min(start + pageSize, entries.length)} of ${entries.length} ${unit}${entries.length === 1 ? "" : "s"}`
    : `0 ${unit}s found`;
  $("#cards-layout").setAttribute("aria-pressed", String(state.layout === "cards"));
  $("#list-layout").setAttribute("aria-pressed", String(state.layout === "list"));
  $("#pagination").hidden = pageCount === 1;
  $("#previous-page").disabled = page === 1;
  $("#next-page").disabled = page === pageCount;
  $("#page-summary").textContent = `Page ${page} of ${pageCount}`;
  const results = $("#results");
  results.classList.toggle("list-view", state.layout === "list");
  results.replaceChildren();
  if (entries.length) {
    results.append(...entries.slice(start, start + pageSize).map(card));
  } else {
    const empty = element("div", "empty-state");
    const hasFilters = Boolean(query || type || selectedSet || tagQuery);
    empty.append(element("span", "empty-icon", "{ }"), element("h3", "", hasFilters ? "No matches this time" : "Your next great check starts here"),
      element("p", "", hasFilters ? "Try a different search or reset your filters." : "There are no entries in this collection yet. Add a JSON ruleset to /rulesets to share it here."));
    results.append(empty);
  }
}

function resetPages() {
  state.pages.rules = 1;
  state.pages.rulesets = 1;
}

for (const selector of controls) $(selector).addEventListener($(selector).type === "search" ? "input" : "change", () => {
  resetPages();
  render();
});
$("#reset").addEventListener("click", () => {
  for (const selector of controls) $(selector).value = selector === "#sort" ? "name" : "";
  resetPages();
  render();
});
for (const view of ["rules", "rulesets"]) $(`#${view}-view`).addEventListener("click", () => {
  state.view = view;
  render();
});
for (const layout of ["cards", "list"]) $(`#${layout}-layout`).addEventListener("click", () => {
  state.layout = layout;
  render();
});
$("#previous-page").addEventListener("click", () => {
  if (state.pages[state.view] > 1) state.pages[state.view]--;
  render();
});
$("#next-page").addEventListener("click", () => {
  if (!$("#next-page").disabled) state.pages[state.view]++;
  render();
});
$("#url-mode").addEventListener("change", () => {
  $("#url-reference").textContent = $("#url-mode").value === "commit"
    ? `Pinned to build commit: ${state.source.commitSha}`
    : `Tracks the latest committed rulesets on ${state.source.headRef}.`;
  $("#url-status").textContent = "";
  $("#url-fallback").hidden = true;
});
$("#clear-selection").addEventListener("click", () => {
  state.selected.clear();
  updateSelection();
  render();
});
$("#download-catalog").addEventListener("click", () => {
  if (!state.ready || !state.selected.size) return;
  downloadJSON(createCatalog(state.rulesets, state.selected, state.source,
    $("#url-mode").value, $("#catalog-name").value), "fab-inspector-catalog.json");
});
$("#clear-rules").addEventListener("click", () => {
  state.selectedRules.clear();
  updateSelection();
  render();
});
$("#download-ruleset").addEventListener("click", () => {
  if (!state.ready || !state.selectedRules.size) return;
  downloadJSON(createRuleset(state.rulesets, state.selectedRules, $("#ruleset-name").value), "fab-inspector-ruleset.json");
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
    if (!Array.isArray(catalog.rulesets) || !catalog.source?.repository
        || !catalog.source.headRef || !/^[a-f0-9]{40}$/i.test(catalog.source.commitSha)) {
      throw new Error("Invalid catalog format");
    }
    state.rulesets = catalog.rulesets;
    state.source = catalog.source;
    $("#url-mode").options[0].textContent = `Branch head (${state.source.headRef})`;
    $("#url-mode").disabled = false;
    $("#url-reference").textContent = `Tracks the latest committed rulesets on ${state.source.headRef}.`;
    const ruleCount = state.rulesets.reduce((sum, set) => sum + set.rules.length, 0);
    $("#catalog-summary").textContent = `out of ${state.rulesets.length} rulesets / ${ruleCount} rules`;
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
