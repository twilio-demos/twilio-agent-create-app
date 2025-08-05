#!/usr/bin/env node

const { program } = require('commander');
const inquirer = require('inquirer');
const chalk = require('chalk');
const ora = require('ora');
const fs = require('fs-extra');
const path = require('path');
const { generateProject } = require('./generator');

program
  .name('create-twilio-agent')
  .description('Create a new Twilio agent with a single command')
  .version('1.0.0')
  .argument('[project-name]', 'Name of the project')
  .option('-y, --yes', 'Skip prompts and use defaults')
  .action(async (projectName, options) => {
    try {
      const answers = await getProjectConfig(projectName, options);
      await generateProject(answers);
    } catch (error) {
      console.error(chalk.red('Error:'), error.message);
      process.exit(1);
    }
  });

async function getProjectConfig(projectName, options) {
  const answers = {};

  // Get project name
  if (!projectName) {
    const { name } = await inquirer.prompt([
      {
        type: 'input',
        name: 'name',
        message: 'What is your project named?',
        default: 'my-twilio-agent',
        validate: (input) => {
          if (!input.trim()) {
            return 'Project name cannot be empty';
          }
          if (fs.existsSync(input)) {
            return 'A directory with this name already exists';
          }
          return true;
        }
      }
    ]);
    answers.projectName = name;
  } else {
    answers.projectName = projectName;
  }

  if (options.yes) {
    // Use defaults - include most common tools
    answers.toolCalls = ['sendText', 'sendRCS', 'getSegmentProfile', 'sendToLiveAgent', 'switchLanguage'];
    answers.packageManager = 'npm';
    answers.git = true;
  } else {
    // Interactive prompts
    const { toolCalls } = await inquirer.prompt([
      {
        type: 'checkbox',
        name: 'toolCalls',
        message: 'Which voice agent tools would you like to include?',
        choices: [
          { name: 'Send Text Message', value: 'sendText', checked: true },
          { name: 'Send RCS Message', value: 'sendRCS', checked: true },
          { name: 'Send Email', value: 'sendEmail' },
          { name: 'Get Customer Profile', value: 'getSegmentProfile', checked: true },
          { name: 'Get Customer Events', value: 'getSegmentEvents' },
          { name: 'Update Customer Profile', value: 'updateSegmentProfile' },
          { name: 'Track Customer Event', value: 'postSegmentTrack' },
          { name: 'Get Customer Data', value: 'getAirtableData' },
          { name: 'Update Customer Data', value: 'upsertAirtableData' },
          { name: 'Send to Live Agent', value: 'sendToLiveAgent', checked: true },
          { name: 'Switch Language', value: 'switchLanguage', checked: true }
        ]
      }
    ]);
    answers.toolCalls = toolCalls;

    const { packageManager } = await inquirer.prompt([
      {
        type: 'list',
        name: 'packageManager',
        message: 'Which package manager would you like to use?',
        choices: [
          { name: 'npm', value: 'npm' },
          { name: 'yarn', value: 'yarn' },
          { name: 'pnpm', value: 'pnpm' }
        ],
        default: 'npm'
      }
    ]);
    answers.packageManager = packageManager;

    const { git } = await inquirer.prompt([
      {
        type: 'confirm',
        name: 'git',
        message: 'Would you like to initialize a git repository?',
        default: true
      }
    ]);
    answers.git = git;
  }

  // Always use TypeScript to match ramp-agent
  answers.typescript = true;

  return answers;
}

program.parse();