import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

let translations: Record<string, any> = {}; // 번역 데이터를 저장



// 번역 키 검색 함수
function findTranslation(key: string): string | undefined {
    const keys = key.split('.'); // 점(.)으로 구분된 키
    let value: any = translations;

    for (const k of keys) {
        if (value && typeof value === 'object' && value[k]) {
            value = value[k].value || value[k]; // value 속성을 우선 탐색
        } else {
            return undefined; // 키를 찾을 수 없음
        }
    }

    return typeof value === 'string' ? value : undefined;
}



// JSON 파일 읽기 함수
function loadTranslations(workspaceFolder: vscode.WorkspaceFolder | undefined) {
    const config = getConfig(workspaceFolder);

    const translationFiles = config.translationFiles || [];
    if (translationFiles.length === 0) {
        vscode.window.showErrorMessage('No translation files specified in the configuration.');
        return;
    }

    try {
        translations = {}; // 번역 데이터 초기화
        for (const file of translationFiles) {
            const translationPath = path.join(workspaceFolder?.uri.fsPath || '', file);
            if (fs.existsSync(translationPath)) {
                const content = fs.readFileSync(translationPath, 'utf8');
                const json = JSON.parse(content);

                // 병합하면서 각 키의 출처를 기록
                for (const [key, value] of Object.entries(json)) {
                    translations[key] = {
                        value,
                        source: translationPath
                    };
                }
            } else {
                vscode.window.showWarningMessage(`Translation file not found: ${translationPath}`);
            }
        }
        vscode.window.showInformationMessage('Translations loaded successfully!');
    } catch (error) {
        vscode.window.showErrorMessage(
            'Failed to load translation files: ' + (error instanceof Error ? error.message : String(error))
        );
    }
}





function registerHoverProvider(context: vscode.ExtensionContext) {
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


function registerDefinitionProvider(context: vscode.ExtensionContext) {
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
    let value: any = translations;
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



function getConfig(workspaceFolder: vscode.WorkspaceFolder | undefined): { translationFiles: string[] } {
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


async function createConfigFile(workspaceFolder: vscode.WorkspaceFolder | undefined) {
    if (!workspaceFolder) {
        vscode.window.showErrorMessage('No workspace folder found!');
        return;
    }

    const configPath = path.join(workspaceFolder.uri.fsPath, 'i18n-helper.json');

    if (fs.existsSync(configPath)) {
        vscode.window.showWarningMessage('Configuration file "i18n-helper.json" already exists.');
        return;
    }

    try {
        // 파일 선택 창 열기
        const selectedFiles = await vscode.window.showOpenDialog({
            canSelectFiles: true,          // 파일 선택 가능
            canSelectFolders: false,       // 폴더 선택 불가
            canSelectMany: true,           // 다중 선택 가능
            filters: {                     // JSON 파일 필터
                'JSON Files': ['json'],
                'All Files': ['*']
            },
            openLabel: 'Select Translation Files'
        });

        if (!selectedFiles || selectedFiles.length === 0) {
            vscode.window.showErrorMessage('No files selected. Configuration creation cancelled.');
            return;
        }

        // 선택된 파일 경로 가져오기
        const translationFiles = selectedFiles.map(file =>
            path.relative(workspaceFolder.uri.fsPath, file.fsPath)
        );

        // 설정 파일 내용 생성
        const defaultConfig = {
            translationFiles
        };

        fs.writeFileSync(configPath, JSON.stringify(defaultConfig, null, 4), 'utf8');
        vscode.window.showInformationMessage(`Configuration file "i18n-helper.json" created successfully at ${configPath}`);
    } catch (error) {
        vscode.window.showErrorMessage(
            'Failed to create configuration file: ' + (error instanceof Error ? error.message : String(error))
        );
    }
}



async function loadTranslationsWithConfig(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder | undefined) {
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


export function activate(context: vscode.ExtensionContext) {
    console.log('i18n-helper extension is now active!!!!');

    // 명령어: JSON 파일 로드
    const loadCommand = vscode.commands.registerCommand('i18n-helper.loadTranslations', async () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        await loadTranslationsWithConfig(context, workspaceFolder);
    });

    // 명령어: 번역 키 검색
    const searchCommand = vscode.commands.registerCommand('i18n-helper.searchTranslation', async () => {
        const key = await vscode.window.showInputBox({ prompt: 'Enter the i18n key to search' });
        if (key) {
            const translation = findTranslation(key);
            if (translation) {
                vscode.window.showInformationMessage(`Translation: ${translation}`);
            } else {
                vscode.window.showErrorMessage('Translation key not found!');
            }
        }
    });

    // 명령어: 설정 파일 생성
    const createConfigCommand = vscode.commands.registerCommand('i18n-helper.createConfigFile', () => {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        createConfigFile(workspaceFolder);
    });

    context.subscriptions.push(loadCommand);
    context.subscriptions.push(searchCommand);
    context.subscriptions.push(createConfigCommand);

    // 번역 키 정의로 이동
    registerDefinitionProvider(context);

    // 번역 키 툴팁 등록
    registerHoverProvider(context);
}



export function deactivate() {}
