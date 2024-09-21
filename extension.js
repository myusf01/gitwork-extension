const vscode = require('vscode');

let myStatusBarItem;
let isWorkCommitMode = false;

function activate(context) {
    console.log('Git Work Commit extension is now active');

    // Register the main command
    let disposable = vscode.commands.registerCommand('extension.gitWorkCommit', toggleWorkCommit);
    context.subscriptions.push(disposable);

    // Create a status bar item
    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    myStatusBarItem.command = 'extension.gitWorkCommit';
    context.subscriptions.push(myStatusBarItem);

    // Initial update of the status bar
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

async function performWorkCommit() {
    try {
        const config = vscode.workspace.getConfiguration('gitWorkCommit');
        const commitMessage = await vscode.window.showInputBox({
            prompt: 'Enter commit message',
            value: config.get('defaultCommitMessage', 'Work in progress'),
        });

        if (commitMessage) {
            const terminal = vscode.window.createTerminal('Git Work Commit');
            terminal.sendText(`git commit --allow-empty -m "${commitMessage}"`);
            terminal.show();

            vscode.window.showInformationMessage('Work Commit created successfully');
        } else {
            isWorkCommitMode = false;
            updateStatusBarItem();
            vscode.window.showInformationMessage('Work Commit cancelled');
        }
    } catch (error) {
        vscode.window.showErrorMessage(`Error creating Work Commit: ${error.message}`);
        isWorkCommitMode = false;
        updateStatusBarItem();
    }
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}