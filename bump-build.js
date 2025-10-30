#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const buildInfoPath = path.join(__dirname, '..', 'src', 'renderer', 'buildInfo.ts');
if (!fs.existsSync(buildInfoPath)) {
  console.error('buildInfo.ts not found at', buildInfoPath);
  process.exit(1);
}

let content = fs.readFileSync(buildInfoPath, 'utf8');
const match = content.match(/build:\s*(\d+)/);
if (!match) {
  console.error('Could not find build number in buildInfo.ts');
  process.exit(1);
}
const current = parseInt(match[1], 10);
const next = current + 1;
content = content.replace(/(build:\s*)\d+/, `$1${next}`);
fs.writeFileSync(buildInfoPath, content, 'utf8');
console.log(`Bumped build number: ${current} -> ${next}`);

// Update CHANGELOG.md with a new build entry at the top
try {
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  const date = new Date().toISOString().slice(0, 10);
  const entryHeader = `## Build ${next} - ${date}\n\n- automated build\n\n`;
  let changelog = '';
  if (fs.existsSync(changelogPath)) {
    changelog = fs.readFileSync(changelogPath, 'utf8');
  }
  fs.writeFileSync(changelogPath, entryHeader + changelog, 'utf8');
  console.log('CHANGELOG.md updated');
} catch (e) {
  console.log('Failed to update CHANGELOG.md', e.message);
}

// Try to commit and tag, but don't fail if git isn't available or fails
try {
  const { execSync } = require('child_process');
  const changelogPath = path.join(__dirname, '..', 'CHANGELOG.md');
  execSync(`git add "${buildInfoPath}" "${changelogPath}"`, { stdio: 'ignore' });
  execSync(`git commit -m "Build ${next}: automated bump and CHANGELOG entry"`, { stdio: 'ignore' });
  execSync(`git tag -a "build-${next}" -m "Build ${next}"`, { stdio: 'ignore' });
  console.log('Committed and tagged build-', next);
  // Optionally push commit and tags to remote. Can be disabled via AUTO_PUSH=0 or DISABLE_AUTO_PUSH=1
  try {
    const autoPushDisabled = process.env.AUTO_PUSH === '0' || process.env.AUTO_PUSH === 'false' || process.env.DISABLE_AUTO_PUSH === '1';
    if (!autoPushDisabled) {
      // check remotes
      const remotes = execSync('git remote').toString().trim().split('\n').filter(Boolean);
      if (remotes.length === 0) {
        console.log('No git remotes configured, skipping push.');
      } else {
        // determine current branch
        const branch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
        const remote = remotes.includes('origin') ? 'origin' : remotes[0];
        console.log(`Pushing branch ${branch} to remote ${remote}...`);
        execSync(`git push ${remote} ${branch}`, { stdio: 'ignore' });
        console.log('Pushed branch. Pushing tags...');
        execSync(`git push ${remote} --tags`, { stdio: 'ignore' });
        console.log('Pushed tags to', remote);
      }
    } else {
      console.log('AUTO_PUSH disabled, skipping git push.');
    }
  } catch (e) {
    console.log('Git push skipped or failed:', e.message);
  }
} catch (e) {
  console.log('Git commit/tag skipped or failed:', e.message);
}
