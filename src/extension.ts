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

    const flag = config.flag; // 플래그 값
    const translationFiles = config.translationFiles || [];

    if (translationFiles.length === 0) {
        vscode.window.showErrorMessage('No translation files specified in the configuration.');
        return;
    }

    try {
        translations = {}; // 번역 데이터 초기화

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
function loadTranslationFile(filePath: string, isSelected: boolean) {
    const content = fs.readFileSync(filePath, 'utf8');
    const json = JSON.parse(content);

    for (const [key, value] of Object.entries(json)) {
        translations[key] = {
            value,
            source: filePath
        };
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



function getConfig(workspaceFolder: vscode.WorkspaceFolder | undefined): { flag?: string; translationFiles: string[] } {
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

function watchTranslationFiles(context: vscode.ExtensionContext, workspaceFolder: vscode.WorkspaceFolder | undefined) {
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
    for (const key in translations) {
        if (translations[key].source === filePath) {
            delete translations[key];
        }
    }
    vscode.window.showInformationMessage(`Removed translations from: ${filePath}`);
}

function resolvePath(workspaceFolder: vscode.WorkspaceFolder | undefined, filePath: string): string {
    if (path.isAbsolute(filePath)) {
        return filePath; // 절대 경로는 그대로 반환
    }
    return path.join(workspaceFolder?.uri.fsPath || '', filePath); // 상대 경로를 절대 경로로 변환
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

    context.subscriptions.push(loadCommand, searchCommand, createConfigCommand);

    // 번역 파일 변경 감지 시작
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        watchTranslationFiles(context, workspaceFolder);
    }

    // 번역 키 정의로 이동
    registerDefinitionProvider(context);

    // 번역 키 툴팁 등록
    registerHoverProvider(context);
}




export function deactivate() {}
