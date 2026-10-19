# GitHub preparation

Use the FitTrack directory as the repository root so the included workflow paths resolve. No remote repository, commit or push was created automatically.

The ignore rules exclude node_modules, dist, .env files (including .env.demo.local), logs, local stop markers and common private-key files. Commit both package-lock.json files and backend/.env.example. Review any new files before staging; ignore rules are a guard, not a substitute for review.

From FitTrack:

```powershell
git init -b main
git status --short --untracked-files=all
git check-ignore backend/.env backend/.env.demo.local
```

Review the README, demo guide and screenshots for material you want to share. No license has been selected; choose one if you intend to grant reuse rights. Then stage the reviewed project files, inspect the staged diff, and create your initial commit. Create an empty GitHub repository in your own account, add its actual remote URL and push main. Do not put credentials in a remote URL or commit demo environment files.

The workflow in .github/workflows/verify.yml installs locked dependencies, starts MongoDB and runs backend tests, integration tests, frontend tests and the frontend build. Its first remote run is still required to verify GitHub execution; local checks do not establish that result.
