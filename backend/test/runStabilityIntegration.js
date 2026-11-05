import { spawnSync } from 'node:child_process';
import { assertIsolatedTestTarget } from './isolatedTestGuard.js';
import '../src/config/envConfig.js';
import { fileURLToPath } from 'node:url';

assertIsolatedTestTarget(process.env.TEST_BASE_URL || 'http://127.0.0.1:18082');
for (const name of ['testRedisStartup.js', 'testSessionApi.js', 'testBuildApi.js', 'testNicknameApi.js', 'testBattleRulesApi.js', 'testMatchResultApi.js']) {
  console.log(`\n=== ${name} ===`);
  const result = spawnSync(process.execPath, [fileURLToPath(new URL(name, import.meta.url))], { stdio: 'inherit', env: process.env, timeout: 180000 });
  if (result.status !== 0) { process.exitCode = 1; break; }
}
if (!process.exitCode) console.log('\nPASS: complete stability integration suite');
