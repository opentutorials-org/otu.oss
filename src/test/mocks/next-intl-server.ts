export const getTranslations = async (_ns?: string) => {
    return (key: string, params?: Record<string, any>) => {
        if (key === 'monthly-usage-exceeded') {
            const resetDate = params?.resetDate ?? '';
            const daysRemaining = params?.daysRemaining ?? '';
            return `월간 사용량이 초과되었습니다. 다음 초기화 일자: ${resetDate} (${daysRemaining}일 남음)`;
        }
        return String(key);
    };
};
