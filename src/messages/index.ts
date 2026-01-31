export async function loadMessages(locale: string, module: string) {
    try {
        const messages = (await import(`./${locale}/${module}.json`)).default;
        return messages;
    } catch (error) {
        console.error(`Failed to load ${module} messages for locale: ${locale}`);
        return {};
    }
}
