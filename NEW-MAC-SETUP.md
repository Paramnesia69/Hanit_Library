# Setup on this Mac (after a full-Mac clone)

You got here by cloning the other Mac (Migration Assistant / disk clone), so
**everything is already here** — the project, `node_modules`, `.env.development.local`
(your KV_* + EDIT_PASSPHRASE secrets), Node 24, npm, the `vercel` CLI + login,
git + remote + credentials. Don't re-pull or reinstall any of that.

## The one thing that will break: native binaries

`node_modules` has compiled `.node` files that were quarantined + signed for the
*other* Mac, so macOS blocks them here ("library load disallowed by system policy"
/ "Cannot find native binding") and the dev server won't start. Re-sign them once,
from the project root:

```bash
for f in $(find node_modules -name "*.node"); do
  xattr -d com.apple.quarantine "$f" 2>/dev/null
  codesign --force --sign - "$f"
done
```

Then start it:

```bash
npm run dev      # UI only → http://localhost:5173
# or
vercel dev       # also serves the /api/books gateway
```

If it still complains, the clean fallback is `rm -rf node_modules && npm install`,
**then re-run the re-sign loop above** (a fresh install re-downloads quarantined
binaries). Re-run the loop after any `npm install` that pulls new native binaries.

## Day to day (both Macs)

Git is how the two stay in sync after this one-time setup:

- `git pull` when you sit down, `git push` before you walk away.
- Commit straight to `main` — no per-Mac branches. Use a short-lived feature
  branch only for risky/unfinished work you don't want auto-deployed live.
- Live library data (books) syncs on its own via Upstash — nothing to do.
