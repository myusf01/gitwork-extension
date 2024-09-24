const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

// Status bar items
let myStatusBarItem;
let isWorkCommitMode = false;
let aliasStatusBarItem;

/**
 * Activates the extension.
 * This function is called when the extension is activated.
 * It sets up commands, status bar items, and initializes the extension.
 * @param {vscode.ExtensionContext} context - The extension context
 */
function activate(context) {
    console.log('Git Work Commit extension is now active');

    // Register the main command to toggle Work Commit mode
    let disposable = vscode.commands.registerCommand('extension.gitWorkCommit', toggleWorkCommit);
    context.subscriptions.push(disposable);

    // Register the command to create a new Git alias
    let createAliasDisposable = vscode.commands.registerCommand('extension.createGitAlias', createGitAlias);
    context.subscriptions.push(createAliasDisposable);

    // Create and set up the status bar item
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    myStatusBarItem.command = 'extension.gitWorkCommit';
    context.subscriptions.push(myStatusBarItem);

    updateStatusBarItem();
}

/**
 * Toggles the Work Commit mode on and off.
 * This function is called when the user clicks on the status bar item.
 */
function toggleWorkCommit() {
    isWorkCommitMode = !isWorkCommitMode;
    updateStatusBarItem();

    if (isWorkCommitMode) {
        performWorkCommit();
    } else {
        vscode.window.showInformationMessage('Work Commit mode deactivated');
    }
}

/**
 * Updates the status bar item based on the current Work Commit mode.
 * This function changes the text and appearance of the status bar item.
 */
function updateStatusBarItem() {
    if (isWorkCommitMode) {
        myStatusBarItem.text = '$(stop) Stop Work Commit';
        myStatusBarItem.backgroundColor = new vscode.ThemeColor('statusBarItem.warningBackground');
    } else {
        const profiles = getGitProfiles();
        const aliasCount = Object.keys(profiles).filter(name => name.startsWith('alias.')).length;
        myStatusBarItem.text = `$(git-commit) Start Work Commit (${aliasCount} aliases)`;
        myStatusBarItem.backgroundColor = undefined;
    }
    myStatusBarItem.show();
}

/**
 * Parses the content of the .gitconfig file.
 * @param {string} content - The content of the .gitconfig file
 * @returns {Object} An object containing the parsed Git aliases
 */
function parseGitConfig(content) {
    const profiles = {};
    let currentSection = null;

    content.split('\n').forEach(line => {
        line = line.trim();
        if (line.startsWith('[') && line.endsWith(']')) {
            currentSection = line.slice(1, -1).toLowerCase();
        } else if (currentSection && line.includes('=')) {
            const [key, value] = line.split('=').map(s => s.trim());
            if (currentSection === 'alias') {
                profiles[`alias.${key}`] = value;
            }
        }
    });

    return profiles;
}

/**
 * Reads and parses the Git config file to get existing aliases.
 * @returns {Object} An object containing the Git aliases
 */
function getGitProfiles() {
    const gitconfigPath = path.join(os.homedir(), '.gitconfig');

    try {
        const content = fs.readFileSync(gitconfigPath, 'utf8');
        return parseGitConfig(content);
    } catch (error) {
        console.error('Error reading .gitconfig:', error);
        return {};
    }
}

/**
 * Creates a new Git alias.
 * This function prompts the user for alias details and adds it to the .gitconfig file.
 * @returns {string|null} The name of the created alias, or null if creation was cancelled
 */
async function createGitAlias() {
    // Prompt for alias name
    const aliasName = await vscode.window.showInputBox({
        prompt: 'Enter the alias name (e.g., sideproject)',
        validateInput: text => {
            return text.length > 0 && !text.includes(' ') ? null : 'Alias name should not be empty or contain spaces';
        }
    });

    if (!aliasName) return null;

    // Prompt for user name
    const userName = await vscode.window.showInputBox({
        prompt: 'Enter the user name for this alias',
        validateInput: text => {
            return text.length > 0 ? null : 'User name should not be empty';
        }
    });

    if (!userName) return null;

    // Prompt for user email
    const userEmail = await vscode.window.showInputBox({
        prompt: 'Enter the user email for this alias',
        validateInput: text => {
            return text.includes('@') ? null : 'Please enter a valid email address';
        }
    });

    if (!userEmail) return null;

    const gitConfigPath = path.join(os.homedir(), '.gitconfig');

    try {
        let configContent = fs.readFileSync(gitConfigPath, 'utf8');
        const aliasSection = '[alias]\n';
        const newAlias = `    ${aliasName} = !git -c user.name='${userName}' -c user.email='${userEmail}'\n`;

        // Add the new alias to the .gitconfig file
        if (configContent.includes('[alias]')) {
            // If [alias] section exists, append to it
            const aliasIndex = configContent.indexOf('[alias]');
            configContent = configContent.slice(0, aliasIndex) + aliasSection + newAlias + configContent.slice(aliasIndex + 7);
        } else {
            // If [alias] section doesn't exist, create it
            configContent += `\n${aliasSection}${newAlias}`;
        }

        fs.writeFileSync(gitConfigPath, configContent);
        vscode.window.showInformationMessage(`Git alias '${aliasName}' created successfully!`);
        return aliasName;
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating Git alias: ${error.message}`);
        return null;
    }
}

/**
 * Performs the Work Commit process.
 * This function handles alias selection, commit message input, and commit creation.
 */
async function performWorkCommit() {
    try {
        const profiles = getGitProfiles();
        const profileNames = Object.keys(profiles).filter(name => name.startsWith('alias.'));

        // Prepare choices for alias selection
        const choices = [
            ...profileNames.map(name => ({
                label: '$(git-branch) ' + name.replace('alias.', ''),
                description: 'Existing alias'
            })),
            {
                label: '$(add) Create new alias',
                description: 'Set up a new Git alias',
                picked: true
            }
        ];

        // Show quick pick for alias selection
        let selectedChoice = await vscode.window.showQuickPick(choices, {
            placeHolder: 'Select a Git profile alias or create a new one'
        });

        if (!selectedChoice) {
            isWorkCommitMode = false;
            updateStatusBarItem();
            return vscode.window.showInformationMessage('Work Commit cancelled');
        }

        let selectedAlias;
        if (selectedChoice.label === '$(add) Create new alias') {
            selectedAlias = await createGitAlias();
            if (!selectedAlias) {
                isWorkCommitMode = false;
                updateStatusBarItem();
                return vscode.window.showInformationMessage('Alias creation cancelled');
            }
        } else {
            selectedAlias = selectedChoice.label.replace('$(git-branch) ', '');
        }

        // Get commit message
        const config = vscode.workspace.getConfiguration('gitWorkCommit');
        const commitMessage = await vscode.window.showInputBox({
            prompt: 'Enter commit message',
            value: config.get('defaultCommitMessage', 'Work in progress'),
        });

        if (commitMessage) {
            // Create and execute the commit command
            const terminal = vscode.window.createTerminal('Git Work Commit');
            terminal.sendText(`git ${selectedAlias} commit --allow-empty -m "${commitMessage}"`);
            terminal.show();

            vscode.window.showInformationMessage('Work Commit created successfully');
        } else {
            vscode.window.showInformationMessage('Work Commit cancelled');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating Work Commit: ${error.message}`);
    } finally {
        isWorkCommitMode = false;
        updateStatusBarItem();
    }
}

/**
 * Deactivates the extension.
 * This function is called when the extension is deactivated.
 */
function deactivate() { }

module.exports = {
    activate,
    deactivate
}