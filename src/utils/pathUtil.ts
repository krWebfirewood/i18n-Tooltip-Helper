import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export function resolvePath(workspaceFolder: vscode.WorkspaceFolder | undefined, filePath: string): string {
    if (path.isAbsolute(filePath)) {
        return filePath; // 절대 경로는 그대로 반환
    }
    return path.join(workspaceFolder?.uri.fsPath || '', filePath); // 상대 경로를 절대 경로로 변환
}