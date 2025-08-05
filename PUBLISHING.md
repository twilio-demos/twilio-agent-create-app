# Publishing Guide

This guide explains how to publish the `create-twilio-agent` package to npm.

## Prerequisites

1. **npm account**: Make sure you have an npm account
2. **Login to npm**: Run `npm login` in your terminal
3. **Package name availability**: Ensure `create-twilio-agent` is available on npm

## Publishing Steps

### 1. Update Package Information

Before publishing, update the following in `package.json`:

- **Author**: Add your name and email
- **Repository**: Update the GitHub URL to your actual repository
- **Homepage**: Update to your actual repository URL
- **Bugs**: Update to your actual repository issues URL

### 2. Test Locally

```bash
# Test the package locally
npm link
create-twilio-agent test-project --yes
```

### 3. Publish to npm

```bash
# Publish the package
npm publish
```

### 4. Verify Installation

After publishing, test the installation:

```bash
# Test with npx
npx create-twilio-agent test-project --yes
```

## Package Structure

The published package includes:

- `index.js` - Main CLI entry point
- `generator-modular.js` - Project generation logic
- `generators/` - All generator modules
- `package.json` - Package metadata
- `README.md` - Documentation
- `.npmignore` - Controls what gets published

## Version Management

To update the package:

1. Update the version in `package.json`
2. Make your changes
3. Test locally
4. Publish with `npm publish`

## Troubleshooting

### Package Name Already Taken

If `create-twilio-agent` is already taken, you can:

1. Choose a different name (e.g., `@yourusername/create-twilio-agent`)
2. Contact the owner of the existing package
3. Use a scoped package name

### Publishing Errors

Common issues:

- **Not logged in**: Run `npm login`
- **Package name conflict**: Check npm registry
- **Missing files**: Ensure `.npmignore` is correct
- **Version conflict**: Increment version number

## Usage After Publishing

Once published, users can run:

```bash
npx create-twilio-agent my-project
```

This will create a new Twilio agent project with all the necessary files and configuration. 