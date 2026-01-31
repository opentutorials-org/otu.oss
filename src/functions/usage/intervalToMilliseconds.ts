export function intervalToMilliseconds(interval: string): number {
    const [value, unit] = interval.split(' ');
    const multiplier = unit === 'days' ? 24 * 60 * 60 * 1000 : 60 * 1000;
    return parseInt(value) * multiplier;
}
