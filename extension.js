const vscode = require('vscode');

function activate(context) {
    console.log('Git Work Commit extension is now active');

    let disposable = vscode.commands.registerCommand('extension.gitWorkCommit', function () {
        console.log('Git Work Commit command executed');
        const terminal = vscode.window.createTerminal('Git Work Commit');
        terminal.sendText('git work commit --allow-empty -m "eheheh"');
        terminal.show();
    });

    context.subscriptions.push(disposable);

    // Create a status bar item
    let myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    myStatusBarItem.text = "$(git-commit) Git Work Commit";
    myStatusBarItem.command = 'extension.gitWorkCommit';
    myStatusBarItem.show();
    console.log('Status bar item created and shown');
    context.subscriptions.push(myStatusBarItem);
}

function deactivate() { }

module.exports = {
    activate,
    deactivate
}