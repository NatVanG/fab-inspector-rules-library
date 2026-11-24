export function rulesetURL(set, source, mode) {
  const ref = mode === "commit" ? source.commitSha : source.headRef;
  const path = ["rulesets", ...set.path.split("/")].map(encodeURIComponent).join("/");
  return `https://raw.githubusercontent.com/${source.repository}/${encodeURIComponent(ref)}/${path}`;
}

export function createCatalog(rulesets, selected, source, mode, name) {
  return {
    name: name.trim() || "Fab Inspector Rules Catalog",
    ruleSets: rulesets.filter(set => selected.has(set.path)).map(set => ({
      name: set.name,
      type: "url",
      path: rulesetURL(set, source, mode),
    })),
  };
}
