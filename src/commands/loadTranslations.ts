import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

import { createConfigFile } from './createConfigFile';
import { clearTranslations, setTranslations } from '../state/translationsState';
import { getConfig } from '../utils/configUtils';
import { resolvePath } from '../utils/pathUtil';

export async function loadTranslationsWithConfig(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder | undefined) {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return;
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, 'i18n-helper.json');
    if (!fs.existsSync(configPath)) {
        vscode.window.showWarningMessage('Configuration file "i18n-helper.json" not found. You need to create it first.');
        await createConfigFile(workspaceFolder); // 설정 파일 생성 유도
    }

    // 설정 파일이 생성되었으니 번역 데이터 로드
    loadTranslations(workspaceFolder);
}


// JSON 파일 읽기 함수
function loadTranslations(workspaceFolder: vscode.WorkspaceFolder | undefined) {
    const config = getConfig(workspaceFolder);

    const flag = config.flag; // 플래그 값
    const translationFiles = config.translationFiles || [];

    if (translationFiles.length === 0) {
        vscode.window.showErrorMessage('No translation files specified in the configuration.');
        return;
    }

    try {
        clearTranslations();

        // 플래그 값으로 파일 선택
        if (flag && !isNaN(Number(flag))) {
            const fileIndex = Number(flag) - 1; // 플래그 값은 1부터 시작한다고 가정
            if (fileIndex >= 0 && fileIndex < translationFiles.length) {
                const selectedFile = translationFiles[fileIndex];
                const absolutePath = resolvePath(workspaceFolder, selectedFile);

                if (fs.existsSync(absolutePath)) {
                    loadTranslationFile(absolutePath, true);
                    vscode.window.showInformationMessage(`Loaded translations from: ${selectedFile}`);
                } else {
                    vscode.window.showErrorMessage(`Translation file not found: ${selectedFile}`);
                }
            } else {
                vscode.window.showErrorMessage(`Invalid flag value: ${flag}. No corresponding translation file.`);
            }
        } else {
            vscode.window.showErrorMessage('Invalid or missing flag value. No translation file selected.');
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            'Failed to load translation files: ' + (error instanceof Error ? error.message : String(error))
        );
    }
}

// 번역 파일 로드 및 병합 함수
export function loadTranslationFile(filePath: string, isSelected: boolean) {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    let translations: Record<string, any> = {};

    for (const [key, value] of Object.entries(json)) {
        translations[key] = {
            value,
            source: filePath
        };
    }
    setTranslations(translations);
}