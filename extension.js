const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

let myStatusBarItem;
let isWorkCommitMode = false;
let aliasStatusBarItem;

function activate(context) {
    console.log('Git Work Commit extension is now active');

    let disposable = vscode.commands.registerCommand('extension.gitWorkCommit', toggleWorkCommit);
    context.subscriptions.push(disposable);

    let createAliasDisposable = vscode.commands.registerCommand('extension.createGitAlias', createGitAlias);
    context.subscriptions.push(createAliasDisposable);

    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    myStatusBarItem.command = 'extension.gitWorkCommit';
    context.subscriptions.push(myStatusBarItem);

    updateStatusBarItem();
}

function toggleWorkCommit() {
    isWorkCommitMode = !isWorkCommitMode;
    updateStatusBarItem();

    if (isWorkCommitMode) {
        performWorkCommit();
    } else {
        vscode.window.showInformationMessage('Work Commit mode deactivated');
    }
}

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
async function createGitAlias() {
    const aliasName = await vscode.window.showInputBox({
        prompt: 'Enter the alias name (e.g., sideproject)',
        validateInput: text => {
            return text.length > 0 && !text.includes(' ') ? null : 'Alias name should not be empty or contain spaces';
        }
    });

    if (!aliasName) return null;

    const userName = await vscode.window.showInputBox({
        prompt: 'Enter the user name for this alias',
        validateInput: text => {
            return text.length > 0 ? null : 'User name should not be empty';
        }
    });

    if (!userName) return null;

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
async function performWorkCommit() {
    try {
        const profiles = getGitProfiles();
        const profileNames = Object.keys(profiles).filter(name => name.startsWith('alias.'));

        // Add icons to existing aliases and create new alias option
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

        const config = vscode.workspace.getConfiguration('gitWorkCommit');
        const commitMessage = await vscode.window.showInputBox({
            prompt: 'Enter commit message',
            value: config.get('defaultCommitMessage', 'Work in progress'),
        });

        if (commitMessage) {
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

function deactivate() { }

module.exports = {
    activate,
    deactivate
}