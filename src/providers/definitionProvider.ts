import * as vscode from 'vscode';
import * as fs from 'fs';

import { getTranslations } from '../state/translationsState';

export function registerDefinitionProvider(context: vscode.ExtensionContext) {
    const definitionProvider = vscode.languages.registerDefinitionProvider(
        [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'javascriptreact' },
            { scheme: 'file', language: 'typescriptreact' }
        ],
        {
            provideDefinition(document, position) {
                const range = document.getWordRangeAtPosition(position, /t\(['"`](.+?)['"`]\)/);
                if (!range) {
                    return null;
                }

                const match = document.getText(range).match(/t\(['"`](.+?)['"`]\)/);
                if (!match || match.length < 2) {
                    return null;
                }

                const key = match[1];
                const { source } = findTranslationWithSource(key);

                if (source && fs.existsSync(source)) {
                    const content = fs.readFileSync(source, 'utf8');

                    try {
                        const json = JSON.parse(content); // JSON 파싱
                        const lines = content.split('\n');
                        const keys = key.split('.'); // 점(.)으로 구분된 키

                        let current = json;
                        let currentPath = ''; // 현재 탐색 중인 경로
                        for (const k of keys) {
                            if (current[k] === undefined) {
                                vscode.window.showErrorMessage(`Translation key "${key}" not found in file: ${source}`);
                                return null;
                            }
                            current = current[k];
                            currentPath += currentPath ? `.${k}` : k; // 현재 경로 업데이트
                        }

                        // JSON 데이터를 파일 내 라인 기준으로 탐색
                        let lineIndex = 0;
                        let charIndex = 0;

                        const keyPath = key.split('.');
                        for (let i = 0; i < lines.length; i++) {
                            const line = lines[i];
                            if (line.trim().startsWith(`"${keyPath[keyPath.length - 1]}"`)) { // 정확히 매칭
                                lineIndex = i;
                                charIndex = line.indexOf(`"${keyPath[keyPath.length - 1]}"`);
                                break;
                            }
}


                        const uri = vscode.Uri.file(source);
                        const jsonPosition = new vscode.Position(lineIndex, charIndex);

                        return new vscode.Location(uri, jsonPosition);
                    } catch (error) {
                        vscode.window.showErrorMessage(`Failed to parse JSON in file: ${source}`);
                        return null;
                    }
                }

                vscode.window.showErrorMessage(`Translation key "${key}" not found in any file.`);
                return null;
            }
        }
    );

    context.subscriptions.push(definitionProvider);
}

function findTranslationWithSource(key: string): { value: string | undefined; source: string | undefined } {
    const keys = key.split('.');
    let value: any = getTranslations();
    let source: string | undefined;

    for (const k of keys) {
        if (value && typeof value === 'object' && value[k]) {
            source = value[k].source || source; // 가장 최근의 source 업데이트
            value = value[k].value || value[k]; // value 속성 탐색
        } else {
            return { value: undefined, source: undefined }; // 키를 찾을 수 없음
        }
    }

    return { value: typeof value === 'string' ? value : undefined, source };
}