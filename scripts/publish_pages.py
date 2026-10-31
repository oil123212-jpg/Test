"""Publish the built /Test/ site to gh-pages without changing source checkout.

Run after `cd web && npm run test:pages`. Uses existing Git authentication,
never rewrites source branches, and never force-pushes a deployment branch.
"""
from pathlib import Path
import json
import os
import subprocess
import tempfile

ROOT = Path(__file__).resolve().parents[1]
DIST = ROOT / "web" / "dist"


def git(*args, cwd=ROOT, env=None):
    return subprocess.check_output(["git", *args], cwd=cwd, env=env, text=True).strip()


def main():
    if not (DIST / "index.html").is_file() or not (DIST / ".nojekyll").exists():
        raise SystemExit("Build the Pages website first: cd web && npm run test:pages")
    html = (DIST / "index.html").read_text()
    if '/Test/assets/' not in html or '/Test/favicon.svg' not in html:
        raise SystemExit("Refusing deployment: build must use the /Test/ base path")
    if git("status", "--porcelain"):
        raise SystemExit("Commit source changes before publishing the static website")
    for path in DIST.rglob("*"):
        if path.is_symlink() or not path.resolve().is_relative_to(DIST.resolve()):
            raise SystemExit("Unexpected symlink in static output")
    source_commit = git("rev-parse", "HEAD")
    version = json.loads((ROOT / "web" / "package.json").read_text())["version"]
    (DIST / "version.json").write_text(json.dumps({"version": version, "source_commit": source_commit}) + "\n")
    remote = git("ls-remote", "origin", "refs/heads/gh-pages")
    parent = None
    if remote:
        git("fetch", "--no-tags", "origin", "refs/heads/gh-pages")
        parent = git("rev-parse", "FETCH_HEAD^{commit}")
    gitdir = git("rev-parse", "--absolute-git-dir")
    with tempfile.TemporaryDirectory(prefix="momo-pages-") as temp:
        env = {**os.environ, "GIT_INDEX_FILE": str(Path(temp) / "index")}
        args = (f"--git-dir={gitdir}", f"--work-tree={DIST}")
        git(*args, "read-tree", "--empty", cwd=DIST, env=env)
        git(*args, "add", "--all", "--force", "--", ".", cwd=DIST, env=env)
        tree = git(*args, "write-tree", cwd=DIST, env=env)
        parent_args = ["-p", parent] if parent else []
        commit = git("commit-tree", tree, *parent_args, "-m", f"Deploy momo web v{version} from {source_commit[:7]}")
    git("push", "origin", f"{commit}:refs/heads/gh-pages")
    print(f"Static deployment branch pushed: {commit}")
    print("Live-site activation is managed separately in GitHub Settings > Pages.")


if __name__ == "__main__":
    main()
