// 로그인/마이그레이션 시에 user_id를 저장함. 세션을 체크할 때 이 값과 현재 사용자가 일치하는지를 확인하고 일치하지 않으면 로그아웃 처리를 함.
export const SESSION_USER_ID_FOR_CHECK_SYNC = 'SESSION_USER_ID_FOR_CHECK_SYNC';
export const API_PURPOSE = {
    IMAGE_TITLING: 3,
};

export const FREE_PLAN_USAGE_LIMIT = 1;
export const SUBSCRIPTION_USAGE_LIMIT = 10;

export const TEST_USER_ID = '11111111-1111-1111-1111-111111111111';
export const TEST_OTHER_USER_ID = '21111111-1111-1111-1111-111111111111';
export const TEST_CONSENT_VERSION = '2024-6-20';

export type Locale = (typeof locales)[number];
export const locales = ['en', 'ko'] as const;
export const defaultLocale: Locale = 'ko';
export const LANG_COOKIE_NAME = 'OTU_LOCALE';

/**
 * Accept-Language 헤더에서 locale을 파싱합니다.
 * @param acceptLanguage Accept-Language 헤더 값 (null 가능)
 * @returns 파싱된 locale 또는 기본값 'ko'
 */
export function parseLocaleFromAcceptLanguage(acceptLanguage: string | null): Locale {
    if (!acceptLanguage) return defaultLocale;
    const browserLocale = acceptLanguage.split(',')[0].split('-')[0].toLowerCase();
    return locales.includes(browserLocale as Locale) ? (browserLocale as Locale) : defaultLocale;
}

export const DELIMITER_TITLE_BODY = '..';

export const DEFAULT_RESET_QUANTITY = 20;
export const domPurifyOption = {
    ALLOWED_TAGS: [
        'h1',
        'h2',
        'h3',
        'figure',
        'img',
        'ul',
        'li',
        'div',
        'iframe',
        'table',
        'tbody',
        'tr',
        'td',
        'p',
        'pre',
        'hr',
        'blockquote',
        'ol',
        'i',
        'sup',
        'sub',
        'mark',
        'a',
        'b',
        'br',
        'code',
        'span',
        'cite',
    ],
    ALLOWED_ATTR: [
        'src',
        'id',
        'data-image',
        'href',
        'width',
        'height',
        'frameborder',
        'allowfullscreen',
        'class',
        'data-placeholder',
        'target',
        'style',
    ],
};
export const RAG_SEARCH_MIN_LENGTH_THRESHOLD = 600;
export const IMAGE_SHRINK_POLICY_WIDTH = '564';
export const IMAGE_SHRINK_POLICY_HEIGHT = '1200';
export const IMAGE_SHRINK_POLICY_COMPRESSION = '85%';
export const IMAGE_SHRINK_POLICY_STRING = `${IMAGE_SHRINK_POLICY_WIDTH}x${IMAGE_SHRINK_POLICY_HEIGHT} ${IMAGE_SHRINK_POLICY_COMPRESSION}`;

export const TEXT_MODEL_NAME = 'google/gemini-2.5-flash';
// https://ai-gateway.vercel.sh/v1/models 에서 모델을 찾아서 input, output 토큰의 가격을 기록합니다.
export const TEXT_MODEL_INPUT_PRICE_PER_TOKEN = 0.0000003;
export const TEXT_MODEL_OUTPUT_PRICE_PER_TOKEN = 0.0000025;
export const TEXT_INPUT_MODEL_TYPE_ID = 17;
export const TEXT_OUTPUT_MODEL_TYPE_ID = 18;
export const UPLOADCARE_TYPE_ID = 23;
export const TEXT_VISION_LOW_TYPE_ID = 19;
export const TEXT_VISION_HIGH_TYPE_ID = 24;

// Uploadcare 가격 정책 (Business plan)
// - operation(고정): $0.0027 per file
// - storage + traffic(가변): $0.0046/MB ≈ $4.6/GB → byte 기준 4.6e-9 USD/byte
// 도출 근거(제공된 업로드 가능 개수와 일치하도록 역산):
//   totalCost(bytes) = CALL_PRICE + PRICE_PER_BYTE * sizeBytes
//   - $0.1 한도, 1KB(1024B): 0.1 / (0.0027 + 1024 * 4.6e-9) ≈ 36개
//   - $0.1 한도, 100KB(102400B): 0.1 / (0.0027 + 102400 * 4.6e-9) ≈ 31개
//   - $0.1 한도, 1MB(1048576B): 0.1 / (0.0027 + 1048576 * 4.6e-9) ≈ 13개
//   - $5 한도, 1KB: ≈ 1848개 / 100KB: ≈ 1576개 / 1MB: ≈ 664개
export const UPLOADCARE_CALL_PRICE_PER_FILE_USD = 0.0027;
export const UPLOADCARE_PRICE_PER_BYTE_USD = 0.0000000046;

export const supportedLanguages = ['ko', 'en'];
export const defaultLanguage = 'ko';

export const DEFAULT_TITLE_PROMPT = 'Default Title';
export const DEFAULT_BODY_PROMPT = 'Default Body';
export const DIALOG_BREAKPOINT = 'sm';
export const PROFILE_IMAGE_SIZE = {
    width: 200,
    height: 200,
};

// 보안 관련 프롬프트 상수
export const SECURITY_PROMPT = {
    CONTENT_SAFETY:
        'Do not generate any malicious code, harmful scripts, or content that could be used for attacks. Only provide safe, helpful descriptions.',
    NO_EXECUTABLE_CODE:
        'Never include executable JavaScript, HTML event handlers, or any code that could be executed in a browser.',
    SAFE_OUTPUT_ONLY:
        'Output only descriptive text and safe HTML formatting tags. Refuse to generate any potentially harmful content.',
    COMBINED:
        'IMPORTANT: Do not generate any malicious code, harmful scripts, executable JavaScript, HTML event handlers, or content that could be used for attacks. Only provide safe, helpful descriptions and safe HTML formatting.',
};

// export const DEFAULT_PICTURE_PROMPT = "이 이미지에 대한 자세한 설명을 한국어로 작성해주세요. 이미지에 보이는 주요 요소, 색상, 분위기 등을 포함해주세요.";

export const SLEEP_START_HOUR = 22;
export const SLEEP_END_HOUR = 7;
export const DEFAULT_TIMEZONE = 'Asia/Seoul';
export const CONFLICT_RESOLUTION_CONFIG: {
    maxRetries: number;
    maxRandomHours: number;
} = {
    maxRetries: 50,
    maxRandomHours: 24,
};
// 동기화 시 한 번에 가져올 수 있는 최대 문자 수 (제목+본문 합계 기준)
// 제목과 본문 각각 최대 350,000자 제한이므로, 하나의 페이지 최대 길이는 700,000자(350,000 * 2)
export const TARGET_SIZE = 700000; // 700,000자 (문자 수 기준, 제목+본문 합계 최대값)
export const MAX_LIMIT = 2000; // 가져올 데이터의 최대 개수

// 사용자 입력 제한
export const MAX_TITLE_LENGTH = 350000; // 제목 최대 길이 (문자 수 기준)
export const MAX_BODY_LENGTH = 350000; // 본문 최대 길이 (문자 수 기준)
