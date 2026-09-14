// infra/test/app-synth.test.ts
import { execSync } from 'child_process';
import * as path from 'path';

test('cdk synth --all succeeds for every stack', () => {
  const infraDir = path.join(__dirname, '..');
  expect(() =>
    execSync('npx cdk synth --all --quiet', { cwd: infraDir, stdio: 'pipe' })
  ).not.toThrow();
});
