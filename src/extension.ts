import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as fs from 'fs';
import { debounce } from 'lodash';

let myStatusBarItem: vscode.StatusBarItem;

export function activate({ subscriptions }: vscode.ExtensionContext) {
    
    let disposable = vscode.commands.registerCommand('readability-checker.helloWorld', () => {
        vscode.window.showInformationMessage('Runnning readability checker!');
    });
    subscriptions.push(disposable);

    myStatusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    myStatusBarItem.command = 'readability-checker.helloWorld';
    subscriptions.push(myStatusBarItem);
    
    const debouncedUpdateStatusBarItem = debounce(updateStatusBarItem, 300); // Adjust wait time as needed

    debouncedUpdateStatusBarItem();
    
    if (vscode.workspace.workspaceFolders) {
        vscode.workspace.workspaceFolders.forEach(folder => {
            fs.watch(folder.uri.fsPath, (eventType, filename) => {
                if (filename) {
                    debouncedUpdateStatusBarItem();
                }
            });
        });
    }

    vscode.workspace.onDidChangeTextDocument(event => {
        debouncedUpdateStatusBarItem();
    });
}

export function deactivate() {
    myStatusBarItem.dispose();
}

function updateStatusBarItem() {
    getDiffLines().then((diffLines: string) => {
				validateDiffLines(diffLines);
        myStatusBarItem.show();
    });
}

function getDiffLines(): Promise<string> {
	return new Promise((resolve, reject) => {
		const options = {
			cwd: vscode.workspace.workspaceFolders?.[0].uri.fsPath // 첫 번째 워크스페이스 디렉토리를 작업 디렉토리로 설정
		};
		cp.exec('git diff --shortstat', options, (err, stdout) => {
			if (err) {
				console.error(err);
				resolve('Error executing git command');
			} else {
				resolve(stdout);
			}
		});
	});
}

function validateDiffLines(diffLines: string): void {
	// stdout 예: ' 1 file changed, 1 insertions(+), 1 deletions(-)'
	const match = diffLines.match(/(\d+) insertions?\(\+\), (\d+) deletions?\(-\)/);
	if (match) {
		const insertions = parseInt(match[1]);
		const deletions = parseInt(match[2]);
		const config = vscode.workspace.getConfiguration('readability-checker');
		const insertionLimit: number|undefined = config.get('insertionLimit');
		const deletionLimit: number|undefined = config.get('deletionLimit');
		
		if ((insertionLimit && insertions > insertionLimit) || (deletionLimit && deletions > deletionLimit)) {
			myStatusBarItem.text = `$(thumbsdown) ${diffLines}`;
			myStatusBarItem.color = '#ff6464';
			myStatusBarItem.tooltip = `🤯 Bad readability... Insertions: ${insertions}, Deletions: ${deletions}`;
		}
		else {
			myStatusBarItem.text = `$(thumbsup) ${diffLines}`;
			myStatusBarItem.color = '#32ff32';
			myStatusBarItem.tooltip = `😁 Good readability! Insertions: ${insertions}, Deletions: ${deletions}`;
		}
	} else {
		myStatusBarItem.text = `$(thumbsup) 0 file changed, 0 insertion(+), 0 deletion(-)`;
		myStatusBarItem.color = 'white';
		myStatusBarItem.tooltip = '😕 Could not parse git diff output';
	}
}
