# Publish to GitHub

The connected GitHub tool currently does not provide a **create repository** action. This folder is locally prepared only; publication requires your GitHub authentication.

1. Open https://github.com/new
2. Owner: `gabrieledellamalva06-coding`; name: `agentcanary`; visibility: Public.
3. Do **not** initialize a README, license or .gitignore on GitHub (already included here).
4. In macOS Terminal, extract the ZIP, open the extracted `agentcanary` directory, then:

```bash
npm test
npm start
# In a second tab/Terminal window: npm run demo
# Stop the server with Ctrl+C when you're done

git init
 git add .
 git commit -m "feat: launch AgentCanary local context telemetry alpha"
 git branch -M main
 git remote add origin https://github.com/gabrieledellamalva06-coding/agentcanary.git
 git push -u origin main
```

If Git requests authentication, complete GitHub sign-in via your local credential manager. Never paste a personal access token into a public issue or chat.

Repository URL after successful push: https://github.com/gabrieledellamalva06-coding/agentcanary
