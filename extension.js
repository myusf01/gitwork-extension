const vscode = require('vscode');
const fs = require('fs');
const os = require('os');
const path = require('path');

let myStatusBarItem;
let isWorkCommitMode = false;

function activate(context) {
    console.log('Git Work Commit extension is now active');

    let disposable = vscode.commands.registerCommand('extension.gitWorkCommit', toggleWorkCommit);
    context.subscriptions.push(disposable);

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
        myStatusBarItem.text = '$(git-commit) Start Work Commit';
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

async function performWorkCommit() {
    try {
        const profiles = getGitProfiles();
        const profileNames = Object.keys(profiles).filter(name => name.startsWith('alias.'));

        let selectedAlias;
        if (profileNames.length > 0) {
            selectedAlias = await vscode.window.showQuickPick(profileNames.map(name => name.replace('alias.', '')), {
                placeHolder: 'Select a Git profile alias'
            });
            if (!selectedAlias) {
                isWorkCommitMode = false;
                updateStatusBarItem();
                return vscode.window.showInformationMessage('Work Commit cancelled');
            }
        }

        const config = vscode.workspace.getConfiguration('gitWorkCommit');
        const commitMessage = await vscode.window.showInputBox({
            prompt: 'Enter commit message',
            value: config.get('defaultCommitMessage', 'Work in progress'),
        });

        if (commitMessage) {
            const terminal = vscode.window.createTerminal('Git Work Commit');

            if (selectedAlias) {
                // Use the selected alias
                terminal.sendText(`git ${selectedAlias} commit --allow-empty -m "${commitMessage}"`);
            } else {
                // If no alias selected, just do a regular commit
                terminal.sendText(`git commit --allow-empty -m "${commitMessage}"`);
            }
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