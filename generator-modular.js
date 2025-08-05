const fs = require('fs-extra');
const path = require('path');
const ora = require('ora');
const chalk = require('chalk');

// Import modular generators
const { generatePackageJson } = require('./generators/package.json.js');
const { generateTsConfig, generateProcfile } = require('./generators/config.js');
const { generateAppFile, generateLlmFile, generateVoicesFile } = require('./generators/core.js');
const { generateLibStructure } = require('./generators/lib.js');
const { generateTools } = require('./generators/tools.js');
const { generateRoutes } = require('./generators/routes.js');
const { generateEnvTemplate } = require('./generators/env.js');
const { generateReadme, generateGitignore } = require('./generators/docs.js');
const { initializeGit, installDependencies } = require('./generators/utils.js');

async function generateProject(config) {
  const spinner = ora('Creating your Twilio agent...').start();
  
  try {
    const projectPath = path.resolve(config.projectName);
    
    // Create project directory
    await fs.ensureDir(projectPath);
    
    // Generate package.json with TypeScript setup
    await generatePackageJson(projectPath, config);
    
    // Generate TypeScript configuration
    await generateTsConfig(projectPath);
    
    // Generate Procfile
    await generateProcfile(projectPath);
    
    // Generate main app.ts file
    await generateAppFile(projectPath, config);
    
    // Generate LLM service file
    await generateLlmFile(projectPath, config);
    
    // Generate lib directory structure
    await generateLibStructure(projectPath, config);
    
    // Generate tool files
    await generateTools(projectPath, config);
    
    // Generate routes directory
    await generateRoutes(projectPath, config);
    
    // Generate voices.ts
    await generateVoicesFile(projectPath);
    
    // Generate environment template
    await generateEnvTemplate(projectPath);
    
    // Generate README
    await generateReadme(projectPath, config);
    
    // Generate .gitignore
    await generateGitignore(projectPath);
    
    // Initialize git if requested
    if (config.git) {
      await initializeGit(projectPath);
    }
    
    // Install dependencies
    await installDependencies(projectPath, config);
    
    spinner.succeed(chalk.green('Twilio agent created successfully!'));
    
    console.log('\n' + chalk.cyan('Next steps:'));
    console.log(chalk.white(`  cd ${config.projectName}`));
    console.log(chalk.white('  cp .env.example .env'));
    console.log(chalk.white('  # Edit .env with your Twilio credentials'));
    console.log(chalk.white('  # Edit src/lib/prompts/instructions.md with your agent instructions'));
    console.log(chalk.white(`  ${config.packageManager} run build`));
    console.log(chalk.white(`  ${config.packageManager} start`));
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to create project'));
    throw error;
  }
}

module.exports = { generateProject }; 