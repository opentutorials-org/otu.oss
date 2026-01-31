'use server';
export async function getFirstDayOfMonth(): Promise<number> {
    const currentDate = new Date();
    const year = currentDate.getUTCFullYear();
    const month = String(currentDate.getUTCMonth() + 1).padStart(2, '0'); // 월은 0부터 시작하므로 +1
    const day = '01'; // 항상 1일

    return Number(`${year}${month}${day}`);
}
