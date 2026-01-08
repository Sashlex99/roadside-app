# GitHub Issues Setup Instructions

## Step 1: Create GitHub Personal Access Token

1. Go to GitHub.com and log into your account
2. Click your profile picture (top right) → **Settings**
3. Scroll down and click **Developer settings** (left sidebar)
4. Click **Personal access tokens** → **Tokens (classic)**
5. Click **Generate new token** → **Generate new token (classic)**
6. Fill out the form:
   - **Note**: "Roadside Assistance Issues Management"
   - **Expiration**: Choose "90 days" or "No expiration" 
   - **Scopes**: Check these boxes:
     - ✅ `repo` (Full control of private repositories)
     - ✅ `write:org` (Write org and team membership, read org projects)
7. Click **Generate token**
8. **IMPORTANT**: Copy the token immediately (it won't be shown again!)


## Step 2: Run the PowerShell Script

Open PowerShell in your project directory and run:

```powershell
# Replace YOUR_TOKEN_HERE with the token you just created
.\create_github_issues_rest.ps1 -GitHubToken "YOUR_TOKEN_HERE"
```

**Example:**
```powershell
.\create_github_issues_rest.ps1 -GitHubToken "ghp_abcd1234567890abcdef1234567890abcdef12"
```

## Step 3: Verify Results

The script will:
- ✅ Create priority labels (P0, P1, P2, P3)
- ✅ Create component labels (security, performance, bug, etc.)
- ✅ Create 4 project milestones (Phase 1-4)
- ✅ Create 3 critical GitHub issues with detailed implementation guides

Visit your repository to see the results:
```
https://github.com/sashlex99/roadside-assistance/issues
```

## Troubleshooting

**If you get permission errors:**
- Make sure your token has `repo` scope enabled
- Verify you're the owner/collaborator of the repository

**If the script fails:**
- Check that all issue template files exist in `github_issues/` directory
- Ensure your internet connection is stable
- Verify the repository name is correct (`sashlex99/roadside-assistance`)

## Security Note

- Keep your Personal Access Token secure
- Don't share it or commit it to git
- You can revoke it anytime from GitHub Settings → Developer settings

## Next Steps After Setup

1. **Start with Issue #1** (Race Condition) - highest priority
2. **Follow the implementation guides** in each issue description
3. **Use GitHub's project board** to track progress across milestones
4. **Reference the issues** in your commits (e.g., "Fix race condition - closes #1") 