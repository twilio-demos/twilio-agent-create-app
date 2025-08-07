const fs = require('fs-extra');
const path = require('path');

async function generateTsConfig(projectPath) {
  const tsConfig = {
    compilerOptions: {
      target: "ES2020",
      lib: ["ES2020", "DOM"],
      types: ["node"],
      module: "commonjs",
      outDir: "./dist",
      rootDir: "./",
      strict: true,
      esModuleInterop: true,
      skipLibCheck: true,
      forceConsistentCasingInFileNames: true,
      resolveJsonModule: true,
      declaration: true,
      declarationMap: true,
      sourceMap: true,
      removeComments: false,
      noImplicitAny: true,
      noImplicitReturns: true,
      noImplicitThis: true,
      noUnusedLocals: false,
      noUnusedParameters: false,
      exactOptionalPropertyTypes: false,
      noFallthroughCasesInSwitch: true,
      noUncheckedIndexedAccess: false,
      moduleResolution: "node",
      baseUrl: ".",
      paths: {
        "@/*": ["src/*"]
      }
    },
    include: ["src/**/*", "scripts/**/*"],
    exclude: ["node_modules", "dist", "**/*.test.ts"]
  };

  await fs.writeJson(path.join(projectPath, 'tsconfig.json'), tsConfig, { spaces: 2 });
}

async function generateProcfile(projectPath) {
  const procfile = 'web: node dist/app.js';
  await fs.writeFile(path.join(projectPath, 'Procfile'), procfile);
}

module.exports = { generateTsConfig, generateProcfile }; 