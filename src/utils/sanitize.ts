import DOMPurify from 'dompurify';

export const safeSanitize = (content: string, options?: any): string => {
    if (typeof window !== 'undefined') {
        if (DOMPurify.sanitize) {
            return DOMPurify.sanitize(content, options) as unknown as string;
        }
        // Handle case where DOMPurify is a factory function (e.g. in some environments)
        if (typeof DOMPurify === 'function') {
            const factory = DOMPurify as any;
            const sanitizer = factory(window);
            if (sanitizer && typeof sanitizer.sanitize === 'function') {
                return sanitizer.sanitize(content, options) as unknown as string;
            }
        }
    }
    return '';
};
