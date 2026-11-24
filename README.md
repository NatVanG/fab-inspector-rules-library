# Fab Inspector Rules Library

A searchable, static web client for browsing and downloading reusable
[Fab Inspector](https://github.com/NatVanG/fab-inspector) rules for Microsoft Fabric.

Browse individual rules or whole rulesets, search names, IDs, descriptions and
JSON, and filter by item type, ruleset and tags. Tag search matches partial text
in a rule's optional `tags` string array, ignoring case and surrounding search
whitespace. Rules without tags match only when tag search is empty. In Rulesets
view, a ruleset matches when a rule satisfies both the item-type and tag filters.
JSON previews
include a copy action. Individual rules download as valid `{"rules": [...]}`
rulesets; whole-ruleset downloads preserve the original file, including metadata.
Filters affect browsing only, never the contents of a whole-ruleset download.
In the **Rulesets** view, **Copy URL** copies a raw GitHub URL for the whole
ruleset. Choose **Branch head (main)** for a URL that follows future commits,
or **Current commit SHA** for a URL pinned to the commit used to build the site.
The SHA is embedded at build time, not fetched from GitHub while browsing.

Select **Include in catalog** on multiple rulesets, optionally edit the catalog
name, and use **Download catalog JSON**. Selections survive search, filters and
view changes; **Clear selection** removes them. The downloaded file follows
[Fab Inspector's catalog format](https://github.com/NatVanG/fab-inspector/blob/main/ExampleRules/23-RulesCatalog.json):
`{"name": "...", "ruleSets": [{"name": "...", "type": "url", "path": "https://..."}]}`.
It references complete source files, including disabled rules, using the chosen
URL mode. Commit-pinned links require those files to exist in the published
commit; uncommitted local edits are not available through GitHub URLs.

The client displays rules; it does not execute them or connect to Fabric.

For embedding, add `?embed=true` to the page URL to hide the navigation header
and introductory section. The library and footer remain available. Without
`embed=true`, the full page is shown.

## Adding rulesets

Place valid JSON files in the root `rulesets/` directory. Nested folders and
`.json` extensions of any case are supported. Each file must contain an object
with a `rules` array of JSON objects, following Fab Inspector's format:

```json
{
  "name": "Copy job checks",
  "description": "Check copy job configuration.",
  "rules": [
    {
      "id": "CHECK_COPYJOB_JOBMODE",
      "name": "Copy jobs use Batch mode",
      "itemType": "CopyJob",
      "tags": ["configuration", "batch"],
      "part": "copyjob-content.json",
      "test": [{ "var": "properties.jobMode" }, "Batch"]
    }
  ]
}
```

Ruleset-level `name` and `description` are optional display metadata. Without a
name, the filename becomes the display name. Rules are displayed using their
`name`, then `id`, then their position in the file. All rule properties are
preserved. Missing `disabled` is treated as enabled, as in Fab Inspector.

Commit the file and the next Pages deployment includes it automatically. No
hand-maintained manifest is needed. Invalid JSON or an invalid ruleset shape
fails the build with the source filename; validation does not replace Fab
Inspector's own rule validation.

## Sample collection

`rulesets/samples/` contains seven rules across three sample rulesets: copy job
configuration, Lakehouse shortcuts and report usability. They include enabled
and disabled rules, with and without tags, for trying search, item-type and tag
filters, previews and downloads.

The rule expressions are adapted from Fab Inspector's
[CopyJob](https://github.com/NatVanG/fab-inspector/blob/main/ExampleRules/00-CopyJob-Rules.json),
[Lakehouse](https://github.com/NatVanG/fab-inspector/blob/main/ExampleRules/13-Lakehouse-Rules.json)
and [Report](https://github.com/NatVanG/fab-inspector/blob/main/ExampleRules/37-Report-base-rules.json)
examples, with descriptive display metadata added. They inspect definitions
without calling external APIs. These are illustrative checks, not a recommended
production policy; review their expressions, limits and required definition
parts before executing them with Fab Inspector. Remove or replace the sample
files when you add your own collection.

## Local development

Requires Node.js 22+; no npm dependencies or installation step.

```sh
npm test
npm run build
npm run preview
```

Open <http://localhost:4173>. The preview command requires Python 3. Rebuild
after changing rulesets or files under `web/`; the preview serves `dist/`.
Serve over HTTP rather than opening `index.html` directly so the browser can
fetch the generated catalog and JSON files.

## GitHub Pages

In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**.
The `Deploy rules library to GitHub Pages` workflow validates and builds pull
requests, and builds and deploys pushes to `main`. It can also be run manually.
After deployment the site is available at
<https://natvang.github.io/fab-inspector-rules-library/>.

All application and download paths are relative, supporting both project Pages
URLs and custom domains. The build copies only the web client, generated catalog
and ruleset JSON into `dist/`. No server, API key or runtime GitHub API calls are
needed. Fonts and styling have no third-party runtime dependencies.
The build adds content-based version URLs to scripts and styles so deployments
do not pair new filter markup with stale cached JavaScript.

## Branding

The client reuses the [Fab Inspector logo](https://github.com/NatVanG/fab-inspector/blob/main/docs/Images/FabInsp_500x500.png)
and its pink accent, paired with dark plum text and soft pink surfaces. The
unmodified [official Microsoft Fabric icon](https://learn.microsoft.com/en-us/fabric/fundamentals/icons)
illustrates Fab Inspector applying JSON rules to Fabric items and settings; it
does not imply Microsoft affiliation or that this library executes inspections.
Both logos are served locally from `web/assets/`, alongside their source and
license notices in `NOTICE.txt`, and copied into the Pages build.
