import json
import os
from pathlib import Path
import subprocess
import tempfile


def mock_api(node, responses, bindings):
    if isinstance(node, list):
        return [mock_api(value, responses, bindings) for value in node]
    if not isinstance(node, dict):
        return node
    if list(node) == ["apiget"]:
        url = node["apiget"][0]
        name = f"__apiMock{len(bindings)}"
        bindings[name] = responses[url]
        return {"var": name}
    return {key: mock_api(value, responses, bindings) for key, value in node.items()}


tested = 0
for rule_path in sorted(Path("rulesets").rglob("*.json")):
    relative = rule_path.relative_to("rulesets")
    fixture = Path("test/rule-fixtures") / relative.with_suffix("")
    if not fixture.is_dir() and relative.parts[0] == "samples":
        print(f"Skipping illustrative sample without fixtures: {relative}", flush=True)
        continue
    expected = json.loads((fixture / "expected.json").read_text())
    source = json.loads(rule_path.read_text())
    rule_ids = [rule["id"] for rule in source["rules"]]
    if rule_ids != [expected["ruleId"]]:
        raise RuntimeError(f"{relative}: expected one rule matching the fixture ruleId")
    for outcome in ("pass", "fail"):
        with tempfile.TemporaryDirectory() as temp:
            temp = Path(temp)
            output = temp / "output"
            output.mkdir()
            item = (fixture / outcome).resolve()
            if not item.is_dir() or not any(item.iterdir()):
                raise RuntimeError(f"{relative}: missing or empty {outcome} fixture")
            rules = rule_path.resolve()
            if source["rules"][0]["itemType"] == "none":
                responses = json.loads((item / "api-responses.json").read_text())
                document = json.loads(rule_path.read_text())
                rule = document["rules"][0]
                bindings = {}
                logic = mock_api(rule["test"][0], responses, bindings)
                rule["test"] = [logic, bindings, rule["test"][-1]]
                rule["itemType"] = "Notebook"
                rule["disabled"] = False
                rules = temp / "rule.json"
                rules.write_text(json.dumps(document))
                item = temp / "item"
                item.mkdir()
                (item / ".platform").write_text(json.dumps({
                    "metadata": {"type": "Notebook", "displayName": "api_mock_fixture"}
                }))
            subprocess.run([
                "docker", "run", "--rm", "--network", "none",
                "--user", f"{os.getuid()}:{os.getgid()}",
                "-v", f"{item}:/fixture:ro",
                "-v", f"{rules}:/rule.json:ro",
                "-v", f"{output}:/output",
                "ghcr.io/natvang/fab-inspector:latest",
                "-fabricitem", "/fixture", "-rules", "/rule.json",
                "-formats", "JSON", "-output", "/output",
                "-overwriteoutput", "true", "-verbose", "true",
            ], check=True)
            reports = list(output.glob("*.json"))
            if len(reports) != 1:
                raise RuntimeError(f"{relative}: expected one JSON report for {outcome}")
            results = [
                row for row in json.loads(reports[0].read_text(encoding="utf-8-sig"))["Results"]
                if row["RuleId"] == expected["ruleId"]
            ]
            if not results or any(type(row["Pass"]) is not bool for row in results):
                raise RuntimeError(f"{relative}: missing or invalid results for {outcome}")
            passed = all(row["Pass"] for row in results)
            if passed != (outcome == "pass"):
                raise RuntimeError(f"{relative}: unexpected {outcome} fixture result")
            print(f"OK: {relative} ({outcome})", flush=True)
    tested += 1
if not tested:
    raise RuntimeError("No rules tested")
print(f"Verified {tested} rules against pass and fail fixtures.")
