// infra/test/app-synth.test.ts
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

test('cdk synth --all succeeds for every stack, and dev/prod are properly isolated', () => {
  const infraDir = path.join(__dirname, '..');
  expect(() =>
    execSync('npx cdk synth --all --quiet', { cwd: infraDir, stdio: 'pipe' })
  ).not.toThrow();

  const cdkOutDir = path.join(infraDir, 'cdk.out');
  const manifest = JSON.parse(
    fs.readFileSync(path.join(cdkOutDir, 'manifest.json'), 'utf-8')
  );

  const concerns = ['Auth', 'Data', 'Storage', 'Api', 'Frontend'];
  const envNames = ['dev', 'prod'];
  const expectedStackNames = envNames.flatMap((envName) =>
    concerns.map((concern) => `ShiftManagementPro-${concern}-${envName}`)
  );

  const artifactNames = Object.keys(manifest.artifacts ?? {});
  for (const stackName of expectedStackNames) {
    expect(artifactNames).toContain(stackName);
  }

  // The branch's single most important architectural property: dev and prod
  // are fully isolated. Assert the Api stack's cross-stack import of the Auth
  // stack's UserPool/UserPoolClient outputs points at that same environment's
  // Auth stack, and never at the other environment's.
  for (const envName of envNames) {
    const otherEnv = envName === 'dev' ? 'prod' : 'dev';
    const template = JSON.parse(
      fs.readFileSync(
        path.join(cdkOutDir, `ShiftManagementPro-Api-${envName}.template.json`),
        'utf-8'
      )
    );
    const templateText = JSON.stringify(template);

    expect(templateText).toContain(`ShiftManagementPro-Auth-${envName}:ExportsOutputRefUserPool`);
    expect(templateText).toContain(
      `ShiftManagementPro-Auth-${envName}:ExportsOutputRefUserPoolClient`
    );
    expect(templateText).not.toContain(`ShiftManagementPro-Auth-${otherEnv}:`);
  }
});
