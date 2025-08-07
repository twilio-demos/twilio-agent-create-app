const fs = require('fs-extra');
const path = require('path');
const chalk = require('chalk');
const ora = require('ora');

// Import modular generators
const { generateAppFile, generateLlmFile, generateVoicesFile } = require('./generators/core');
const { generateLibStructure } = require('./generators/lib');
const { generateRoutes } = require('./generators/routes');
const { generateTools } = require('./generators/tools');
const { generateScriptsStructure } = require('./generators/scripts');
const { generateReadme, generateGitignore } = require('./generators/docs');
const { generateTsConfig, generateProcfile } = require('./generators/config');
const { generatePackageJson } = require('./generators/package.json');
const { generateEnvTemplate } = require('./generators/env');

async function generateProject(config) {
  const projectPath = path.resolve(config.projectName);
  
  // Create project directory
  await fs.ensureDir(projectPath);
  
  const spinner = ora('Creating Twilio agent project...').start();
  
  try {
    // Generate core files
    spinner.text = 'Generating core files...';
    await generateAppFile(projectPath, config);
    await generateLlmFile(projectPath, config);
    await generateVoicesFile(projectPath);
    
    // Generate lib files
    spinner.text = 'Generating library files...';
    await generateLibStructure(projectPath, config);
    
    // Generate routes
    spinner.text = 'Generating routes...';
    await generateRoutes(projectPath, config);
    
    // Generate tools
    spinner.text = 'Generating tools...';
    await generateTools(projectPath, config);
    
    // Generate scripts
    if (config.scripts && config.scripts.length > 0) {
      spinner.text = 'Generating Twilio setup scripts...';
      await generateScriptsStructure(projectPath, config);
    }
    
    // Generate docs
    spinner.text = 'Generating documentation...';
    await generateReadme(projectPath, config);
    await generateGitignore(projectPath);
    
    // Generate config files
    spinner.text = 'Generating configuration files...';
    await generateTsConfig(projectPath);
    await generateProcfile(projectPath);
    
    // Generate package.json
    spinner.text = 'Generating package.json...';
    await generatePackageJson(projectPath, config);
    
    // Generate .env.example
    spinner.text = 'Generating environment template...';
    await generateEnvTemplate(projectPath, config);
    
    // Initialize git if requested
    if (config.git) {
      spinner.text = 'Initializing git repository...';
      const { execSync } = require('child_process');
      try {
        execSync('git init', { cwd: projectPath, stdio: 'ignore' });
        execSync('git add .', { cwd: projectPath, stdio: 'ignore' });
        execSync('git commit -m "Initial commit"', { cwd: projectPath, stdio: 'ignore' });
      } catch (error) {
        console.warn(chalk.yellow('Warning: Could not initialize git repository'));
      }
    }
    
    spinner.succeed(chalk.green('Project created successfully!'));
    
    console.log('\n' + chalk.cyan('Next steps:'));
    console.log(chalk.white(`  cd ${config.projectName}`));
    console.log(chalk.white('  npm install'));
    console.log(chalk.white('  cp .env.example .env'));
    console.log(chalk.white('  # Edit .env with your configuration'));
    console.log(chalk.white('  npm run dev'));
    
    console.log('\n' + chalk.yellow('Important:'));
    console.log(chalk.white('  - Configure your .env file with your API keys'));
    console.log(chalk.white('  - Set up your Twilio webhook URLs'));
    console.log(chalk.white('  - Configure your ngrok tunnel for local development'));
    
  } catch (error) {
    spinner.fail(chalk.red('Failed to create project'));
    console.error(chalk.red('Error:'), error.message);
    throw error;
  }
}

module.exports = { generateProject }; 