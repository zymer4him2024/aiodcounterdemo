# AI OD Counter Demo

Real-time object detection counter dashboard with Firebase backend.

## Repository Structure

- **main**: Production branch (stable, deployed to production)
- **feature/***: Feature branches for testing new features

## Git Workflow

### Starting a New Feature

```bash
# 1. Start from main branch (get latest production code)
git checkout main
git pull origin main

# 2. Create a new feature branch
git checkout -b feature/your-feature-name

# 3. Make your changes and commit
git add .
git commit -m "Description of changes"

# 4. Push feature branch to GitHub
git push -u origin feature/your-feature-name
```

### Testing on Staging

```bash
# Deploy to staging Firebase project
firebase use staging
npm run build
firebase deploy --only hosting,functions,firestore

# Test at staging URL
# Fix bugs, commit fixes
git add .
git commit -m "Fix: description of fix"
git push
```

### Merging to Production

```bash
# 1. Switch back to main
git checkout main
git pull origin main

# 2. Merge feature branch
git merge feature/your-feature-name

# 3. Push to GitHub
git push origin main

# 4. Deploy to production
firebase use production
npm run build
firebase deploy --only hosting,functions,firestore

# 5. Clean up (delete feature branch)
git branch -d feature/your-feature-name
git push origin --delete feature/your-feature-name
```

## Firebase Projects

- **Production**: `aiodcounter03` (default)
- **Staging**: `aiodcounter03-staging` (for testing)

Switch between projects:
```bash
firebase use production  # or staging
```

## Current Features

- Real-time traffic counting dashboard
- Daily and monthly aggregates
- Daypart breakdown (Morning, Afternoon, Evening, Night)
- Dynamic pricing analytics
- Multi-language support (English/Portuguese)
- Responsive charts and visualizations

## Development

```bash
# Install dependencies
npm install
cd functions && npm install && cd ..

# Run locally
npm start

# Build for production
npm run build

# Deploy
firebase deploy
```

## Branch Protection

The `main` branch should be protected:
- Require pull request reviews before merging
- Require status checks to pass
- Prevent force pushes



