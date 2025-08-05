const { exec } = require('child_process');
const { promisify } = require('util');
const execAsync = promisify(exec);

async function initializeGit(projectPath) {
  try {
    await execAsync('git init', { cwd: projectPath });
    await execAsync('git add .', { cwd: projectPath });
    await execAsync('git commit -m "Initial commit from create-twilio-agent"', { cwd: projectPath });
  } catch (error) {
    console.warn('Warning: Could not initialize git repository:', error.message);
  }
}

async function installDependencies(projectPath, config) {
  try {
    const installCommand = config.packageManager === 'yarn' ? 'yarn install' : 
                          config.packageManager === 'pnpm' ? 'pnpm install' : 
                          'npm install';
    
    console.log(`Installing dependencies with ${config.packageManager}...`);
    await execAsync(installCommand, { cwd: projectPath });
  } catch (error) {
    console.warn('Warning: Could not install dependencies:', error.message);
    console.log('Please run the install command manually in the project directory.');
  }
}

module.exports = { initializeGit, installDependencies }; 