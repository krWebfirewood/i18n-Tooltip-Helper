import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function getConfig(workspaceFolder: vscode.WorkspaceFolder | undefined): { flag?: string; translationFiles: string[] } {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return { translationFiles: [] }; // 기본값
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, 'i18n-helper.json');
    if (fs.existsSync(configPath)) {
        try {
            const content = fs.readFileSync(configPath, 'utf8');
            const config = JSON.parse(content);

            if (config.translationFiles && Array.isArray(config.translationFiles)) {
                return config;
            } else {
                vscode.window.showErrorMessage('Invalid configuration file: "translationFiles" must be an array.');
            }
        } catch (error) {
            vscode.window.showErrorMessage(
                'Failed to parse configuration file: ' + (error instanceof Error ? error.message : String(error))
            );
        }
    } else {
        vscode.window.showWarningMessage('Configuration file "i18n-helper.json" not found. Using default settings.');
    }

    return { translationFiles: [] }; // 기본값
}