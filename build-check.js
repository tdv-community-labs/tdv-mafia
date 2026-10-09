const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const filesToCheck = [
  'src/app/page.tsx',
  'src/components/voice/VoiceChat.tsx',
  'src/components/modals/CreateRoomModal.tsx',
  'src/components/modals/GameModesCatalogModal.tsx',
  'src/components/modals/LeaderboardModal.tsx',
  'src/components/modals/RulesModal.tsx',
  'src/components/modals/AchievementsModal.tsx',
  'src/components/modals/AuthModal.tsx'
];

console.log('Build check started...');
let hasError = false;

// Since it's TypeScript, we'll run tsc --noEmit instead of node --check
try {
  console.log('Running TypeScript compiler check (tsc --noEmit)...');
  execSync('npx tsc --noEmit', { stdio: 'inherit' });
  console.log('SUCCESS: TypeScript compilation passed.');
} catch (err) {
  console.error('ERROR: TypeScript compilation failed.');
  hasError = true;
}

try {
  console.log('Running Architecture & AI Bot Simulation Tests (npm test)...');
  execSync('npm test', { stdio: 'inherit' });
  console.log('SUCCESS: All test suites passed.');
} catch (err) {
  console.error('ERROR: Test suites failed.');
  hasError = true;
}

if (hasError) {
  process.exit(1);
} else {
  console.log('Build check passed successfully!');
}
