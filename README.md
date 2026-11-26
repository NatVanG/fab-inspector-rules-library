# Fab Inspector Rules Library

Browse the library at <https://natvang.github.io/fab-inspector-rules-library/>.

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
The Rulesets view is selected by default. Both view buttons show the number of
matches for the current search and filters. Results are paged in groups of 12;
use Previous and Next to browse them. Switch between Cards and List layouts
without changing the current page or selections. Changing a filter or sort order
returns both views to their first page.
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

In the **Rules** view, select **Include in ruleset** on one or more rules,
optionally edit the ruleset name, and use **Download ruleset JSON** to combine
them into a `{"name": "...", "rules": [...]}` file.
Rules retain all their original properties, including disabled status. Rule
selections are independent of catalog selections and survive searches, filters
and view changes; **Clear selection** clears the current builder's selections.

The client displays rules; it does not execute them or connect to Fabric.

For embedding, add `?embed=true` to the page URL to hide the navigation header,
introductory section, and library headings. The library and footer remain available. Without
`embed=true`, the full page is shown. In embed mode, HTTP and HTTPS links open in
a new browser window or tab instead of navigating the embedded page; downloads
are unaffected.

Use the **Dark mode** button in the header to switch themes, or add
`?theme=dark` to start in dark mode. Combine the parameters as
`?embed=true&theme=dark` for a dark embedded library. Light mode is the default;
the button changes the current page only and does not change the URL.

## Contributing new ruleset

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

Commit the file and open a pull request so the contribution can be reviewed and
merged. After it is merged, the next Pages deployment includes it automatically.
No hand-maintained manifest is needed. Invalid JSON or an invalid ruleset shape
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
parts before executing them with Fab Inspector. You can remove or replace the
sample files independently of the best-practice collection.

## Fabric best-practice rules

`rulesets/fabric-best-practice/` contains 57 individually downloadable rules
from the [Fab Inspector test harness](https://github.com/NatVanG/fab-inspector-test-harness/tree/f651610a319d09d8710ef0549ab52bb1b32a7dc8/fabric-best-practice-rules),
at revision `f651610a319d09d8710ef0549ab52bb1b32a7dc8`. The corresponding
fixtures and expected rule IDs are in `test/rule-fixtures/fabric-best-practice/`;
the upstream MIT license is in `test/UPSTREAM-LICENSE`. Schema links
point to that revision, and outdated "untested" warnings have been clarified.
Existing sample rulesets remain separate.

Each imported rule passed its upstream pass and fail fixture with the
published Fab Inspector container image. For API rules, the tests replace
`apiget` calls with fixture responses and run a temporary rule as a Notebook;
they also enable the temporary copy if it is disabled. They do not test live
Fabric APIs, authentication, permissions, or tenant configuration. The
fixtures assert pass/fail behavior for the expected rule ID, not every value in
`expected.json`. These examples do not establish production or compliance
suitability. Review and adapt each rule's thresholds, naming patterns,
allowlists, scope, required API permissions, and other assumptions before use.

Upstream rules 37–39, 43–50, and 53–55 are not included because they had no
complete pass/fail fixture sets at the recorded revision.

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

Rule fixture tests run only through GitHub Actions, using the published
`ghcr.io/natvang/fab-inspector:latest` Docker image. The workflow invokes
`scripts/test-rule-fixtures.py`; no PowerShell dependencies are needed.
Each ruleset matches a fixture folder
by its relative path and filename without `.json`: for example,
`rulesets/fabric-best-practice/approved-custom-theme-enforcement.json` uses
`test/rule-fixtures/fabric-best-practice/approved-custom-theme-enforcement/`.
Each folder contains `pass/`, `fail/`, and `expected.json`. Missing fixtures
fail the workflow; illustrative rulesets under `rulesets/samples/` are skipped
when they have no fixtures.

The workflow invokes the container without networking and mounts the rules,
fixtures, and temporary output. The mutable `latest` tag follows new Fab
Inspector releases, so test results can change without repository changes.
GitHub Actions logs the pulled image digest for traceability.

## GitHub Pages

In the repository's **Settings > Pages**, set **Source** to **GitHub Actions**.
The `Deploy rules library to GitHub Pages` workflow runs Node tests,
container-backed rule fixture tests, and the build on pull requests, pushes to
`main`, and manual runs. Deployment follows successful checks on `main` only.
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
and its pink accent in light mode. Dark mode uses the navy, blue and pale text
palette of the Fab Inspector Avalonia UI. The
unmodified [official Microsoft Fabric icon](https://learn.microsoft.com/en-us/fabric/fundamentals/icons)
illustrates Fab Inspector applying JSON rules to Fabric items and settings; it
does not imply Microsoft affiliation or that this library executes inspections.
Both logos are served locally from `web/assets/`, alongside their source and
license notices in `NOTICE.txt`, and copied into the Pages build.
