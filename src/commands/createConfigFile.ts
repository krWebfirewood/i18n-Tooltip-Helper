import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';


export async function createConfigFile(workspaceFolder: vscode.WorkspaceFolder | undefined) {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return;
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, 'i18n-helper.json');

    try {
        let config: { __comments?: Record<string, string>; flag?: string; translationFiles: string[] } = {
            translationFiles: []
        };

        // 기존 설정 파일 읽기
        if (fs.existsSync(configPath)) {
            const content = fs.readFileSync(configPath, 'utf8');
            config = JSON.parse(content);
        }

        // 기본 주석 추가
        if (!config.__comments) {
            config.__comments = {
                flag: "Determines which translation file to use. 1 corresponds to the first file in 'translationFiles', 2 to the second, and so on.",
                translationFiles: "List of translation file paths. Absolute or relative paths are supported."
            };
        }

        // 기본 flag 값 추가
        if (!config.flag) {
            config.flag = "1"; // 기본값
        }

        // 다중 파일 선택
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,
            canSelectFolders: false,
            canSelectMany: true,
            filters: { 'JSON Files': ['json'], 'All Files': ['*'] },
            openLabel: 'Select Translation Files to Add'
        });

        if (!selectedFiles || selectedFiles.length === 0) {
            vscode.window.showErrorMessage('No files selected. Configuration update cancelled.');
            return;
        }

        // 새 파일 경로 추가
        const newFiles = selectedFiles.map(file =>
            path.relative(workspaceFolder.uri.fsPath, file.fsPath) // 항상 상대 경로로 저장
        );
        const uniqueFiles = [...new Set([...config.translationFiles, ...newFiles])]; // 중복 제거

        config.translationFiles = uniqueFiles;

        // 설정 파일 업데이트
        fs.writeFileSync(configPath, JSON.stringify(config, null, 4), 'utf8');
        vscode.window.showInformationMessage(`Updated "i18n-helper.json" with new translation files.`);
    } catch (error) {
        vscode.window.showErrorMessage(
            'Failed to update configuration file: ' + (error instanceof Error ? error.message : String(error))
        );
    }
}