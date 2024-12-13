let translations: Record<string, any> = {}; // 번역 데이터를 저장

export function setTranslations(newTranslations: Record<string, any>) {
    translations = newTranslations;
}

export function getTranslations(): Record<string, any> {
    return translations;
}

export function clearTranslations() {
    translations = {};
}
