// LinguiJS 가상 모듈 (테스트용)
export const getServerI18n = jest.fn().mockResolvedValue({
    _: (descriptor: any) =>
        typeof descriptor === 'string' ? descriptor : descriptor.id || 'translated',
});
