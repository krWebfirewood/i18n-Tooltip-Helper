import * as vscode from 'vscode';

import { getTranslations } from '../state/translationsState';

export function registerHoverProvider(context: vscode.ExtensionContext) {
    const hoverProvider = vscode.languages.registerHoverProvider(
        [
            { scheme: 'file', language: 'javascript' },
            { scheme: 'file', language: 'typescript' },
            { scheme: 'file', language: 'javascriptreact' },
            { scheme: 'file', language: 'typescriptreact' }
        ],
        {
            provideHover(document, position) {
                const range = document.getWordRangeAtPosition(position, /t\(['"`](.+?)['"`]\)/);
                if (!range) {
                    return null;
                }

                const match = document.getText(range).match(/t\(['"`](.+?)['"`]\)/);
                if (!match || match.length < 2) {
                    return null;
                }

                const key = match[1];
                const translation = findTranslation(key);

                if (translation) {
                    return new vscode.Hover(`**Translation**: ${translation}`);
                } else {
                    return new vscode.Hover(`**Translation key not found**: ${key}`);
                }
            }
        }
    );

    context.subscriptions.push(hoverProvider);
}

// 번역 키 검색 함수
function findTranslation(key: string): string | undefined {
    const keys = key.split('.'); // 점(.)으로 구분된 키
    let value: any = getTranslations();

    for (const k of keys) {
        if (value && typeof value === 'object' && value[k]) {
            value = value[k].value || value[k]; // value 속성을 우선 탐색
        } else {
            return undefined; // 키를 찾을 수 없음
        }
    }

    return typeof value === 'string' ? value : undefined;
}