import type { Config } from 'jest';

const config: Config = {
  testEnvironment: 'node',
  rootDir: '.',
  testMatch: ['<rootDir>/src/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/src/__tests__/setup.ts'],
  testTimeout: 20000,
  // Migration tasks run one domain's tests at a time against a shared
  // dedicated test database — keep runs sequential to avoid cross-test
  // data races until each domain has isolated fixtures.
  maxWorkers: 1,
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
  },
  // isolatedModules: transpile per-file with no cross-file type-checking.
  // This mirrors how the app actually runs today (tsx watch / `ts-node`
  // with transpileOnly: true per tsconfig.json) rather than the stricter
  // full-program `tsc` used only by the (currently non-blocking) build
  // script. Pre-existing type drift elsewhere in the codebase — e.g.
  // src/models/Tenant.ts's `mahalluCode` field not being declared on the
  // shared ITenant type — must not block tests for unrelated domains.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { isolatedModules: true }],
  },
};

export default config;
