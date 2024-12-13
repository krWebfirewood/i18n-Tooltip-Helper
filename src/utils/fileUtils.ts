import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { getConfig } from './configUtils';
import { loadTranslationFile } from '../commands/loadTranslations';
import { getTranslations } from '../state/translationsState';

export function watchTranslationFiles(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder | undefined) {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return;
    }

    const config = getConfig(workspaceFolder);
    const translationFiles = config.translationFiles || [];

    if (translationFiles.length === 0) {
        vscode.window.showWarningMessage('No translation files specified in the configuration to watch.');
        return;
    }

    // FileSystemWatcher 설정
    const watchers: vscode.FileSystemWatcher[] = [];
    for (const file of translationFiles) {
        const filePath = path.join(workspaceFolder.uri.fsPath, file);
        const watcher = vscode.workspace.createFileSystemWatcher(filePath);

        // 파일 변경 감지
        watcher.onDidChange(() => {
            vscode.window.showInformationMessage(`Translation file changed: ${file}`);
            reloadTranslationFile(filePath);
        });

        // 파일 삭제 감지
        watcher.onDidDelete(() => {
            vscode.window.showWarningMessage(`Translation file deleted: ${file}`);
            removeTranslationFile(filePath);
        });

        // 파일 생성 감지
        watcher.onDidCreate(() => {
            vscode.window.showInformationMessage(`Translation file created: ${file}`);
            reloadTranslationFile(filePath);
        });

        watchers.push(watcher);
    }

    // 종료 시 FileSystemWatcher 해제
    context.subscriptions.push(...watchers);
    
}

function reloadTranslationFile(filePath: string) {
    if (fs.existsSync(filePath)) {
        loadTranslationFile(filePath, false); // 기존 로직 사용
        vscode.window.showInformationMessage(`Reloaded translation file: ${filePath}`);
    } else {
        vscode.window.showErrorMessage(`Failed to reload translation file: ${filePath}`);
    }
}

function removeTranslationFile(filePath: string) {
    for (const key in getTranslations()) {
        if (getTranslations()[key].source === filePath) {
            delete getTranslations()[key];
        }
    }
    vscode.window.showInformationMessage(`Removed translations from: ${filePath}`);
}
