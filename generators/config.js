const fs = require('fs-extra');
const path = require('path');

async function generateTsConfig(projectPath) {
  const tsConfig = {
    compilerOptions: {
      target: "ES2022",
      lib: ["ES2022"],
      types: ["node"],
      module: "ESNext",
      moduleResolution: "Bundler",
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