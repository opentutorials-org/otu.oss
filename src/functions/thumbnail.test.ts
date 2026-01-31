import { isUploadcareUrl, getThumbnailUrl } from './thumbnail';

describe('thumbnail utilities', () => {
    describe('isUploadcareUrl', () => {
        it('should return true for ucarecdn.com URLs', () => {
            const url = 'https://ucarecdn.com/a-uuid-string/';
            expect(isUploadcareUrl(url)).toBe(true);
        });

        it('should return true for ucarecd.net URLs with subdomains', () => {
            const url = 'https://subdomain.ucarecd.net/a-uuid-string/';
            expect(isUploadcareUrl(url)).toBe(true);
        });

        it('should return false for other URLs', () => {
            const url = 'https://www.google.com/image.jpg';
            expect(isUploadcareUrl(url)).toBe(false);
        });

        it('should return false for invalid URL strings', () => {
            const url = 'not a url';
            expect(isUploadcareUrl(url)).toBe(false);
        });

        it('should return false for null or undefined', () => {
            expect(isUploadcareUrl(null)).toBe(false);
            expect(isUploadcareUrl(undefined)).toBe(false);
        });
    });

    describe('getThumbnailUrl', () => {
        const uuid = '8af22760-cddb-487c-9185-eb1b0c9617a5';
        const expectedParams =
            '-/scale_crop/202x202/center/-/format/auto/-/quality/smart/-/grayscale/';

        it('should apply transformations to a simple ucarecdn.com URL', () => {
            const originalUrl = `https://ucarecdn.com/${uuid}/`;
            const expectedUrl = `https://ucarecdn.com/${uuid}/${expectedParams}`;
            expect(getThumbnailUrl(originalUrl)).toBe(expectedUrl);
        });

        it('should apply transformations to a ucarecd.net URL', () => {
            const originalUrl = `https://45qbiqejxd.ucarecd.net/${uuid}/`;
            const expectedUrl = `https://45qbiqejxd.ucarecd.net/${uuid}/${expectedParams}`;
            expect(getThumbnailUrl(originalUrl)).toBe(expectedUrl);
        });

        it('should ignore existing transformations and apply new ones', () => {
            const originalUrl = `https://ucarecdn.com/${uuid}/-/crop/215x227/464,396/-/preview/564x1200/`;
            const expectedUrl = `https://ucarecdn.com/${uuid}/${expectedParams}`;
            expect(getThumbnailUrl(originalUrl)).toBe(expectedUrl);
        });

        it('should return the original URL if it is not an Uploadcare URL', () => {
            const originalUrl = 'https://www.google.com/image.jpg';
            expect(getThumbnailUrl(originalUrl)).toBe(originalUrl);
        });

        it('should use custom width and height when provided', () => {
            const originalUrl = `https://ucarecdn.com/${uuid}/`;
            const expectedUrl = `https://ucarecdn.com/${uuid}/-/scale_crop/100x150/center/-/format/auto/-/quality/smart/-/grayscale/`;
            expect(getThumbnailUrl(originalUrl, 100, 150)).toBe(expectedUrl);
        });
    });
});
