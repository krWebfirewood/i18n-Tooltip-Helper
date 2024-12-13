import * as vscode from 'vscode';

import { createConfigFile } from './commands/createConfigFile';
import { loadTranslationsWithConfig } from './commands/loadTranslations';
import { registerHoverProvider } from './providers/hoverProvider';
import { registerDefinitionProvider } from './providers/definitionProvider';
import { watchTranslationFiles } from './utils/fileUtils';

export function activate(context: vscode.ExtensionContext) {

    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

    // 명령어 등록
    context.subscriptions.push(
        vscode.commands.registerCommand('i18n-helper.createConfigFile', () => createConfigFile(workspaceFolder)),
        vscode.commands.registerCommand('i18n-helper.loadTranslations', () => loadTranslationsWithConfig(context, workspaceFolder))
    );
    // // 번역 파일 변경 감지 시작
    if (workspaceFolder) {
        watchTranslationFiles(context, workspaceFolder);
    }
    // // 번역 키 정의로 이동
    registerDefinitionProvider(context);

    // // 번역 키 툴팁 등록
    registerHoverProvider(context);
}


export function deactivate() {}
