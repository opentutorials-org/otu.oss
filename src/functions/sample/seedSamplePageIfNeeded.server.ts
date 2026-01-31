import { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { ulid } from 'ulid';
import { getUserLocale } from '@/i18n-server';
import { sampleLogger } from '@/debug/sample';
import { getTranslations } from 'next-intl/server';
import { captureException } from '@sentry/nextjs';

/**
 * 신규 사용자에게 샘플 페이지를 1회 생성합니다.
 *
 * 특징:
 * - 회원가입 시에만 실행 (addUsageRecordIfNotExists에서 usage가 없을 때)
 * - 사용자 로케일에 맞는 샘플 콘텐츠 제공
 * - 멱등성 보장: ON CONFLICT DO NOTHING으로 중복 생성 방지
 *
 * @param userId 사용자 ID
 * @param supabase Supabase 클라이언트
 */
export async function seedSamplePageIfNeeded(
    userId: string,
    supabase: SupabaseClient
): Promise<void> {
    sampleLogger('샘플 페이지 생성 시작', { userId });

    try {
        // 1. 사용자 로케일 확인
        const locale = await getUserLocale();
        sampleLogger('사용자 로케일 확인', { locale });

        // 2. 로케일에 맞는 샘플 콘텐츠 로드 (raw 함수로 ICU 파싱 우회)
        const t = await getTranslations({ locale, namespace: 'sample' });
        const title = t.raw('title') as string;
        const bodyHtml = t.raw('body') as string;

        // data-block-id 추가
        const body = addBlockIds(bodyHtml);

        sampleLogger('샘플 콘텐츠 로드 완료', { title, bodyLength: body.length });

        // 3. 결정적 ID 생성 (user_id 기반 고정값)
        // 같은 사용자에 대해 항상 동일한 ID를 생성하여 중복 방지
        const samplePageId = createDeterministicSamplePageId(userId);

        sampleLogger('샘플 페이지 ID 생성', { samplePageId });

        // 4. 샘플 페이지 삽입 (ON CONFLICT DO NOTHING으로 멱등성 보장)
        const { data, error } = await supabase
            .from('page')
            .insert({
                id: samplePageId,
                user_id: userId,
                title: title,
                body: body,
                type: 'text',
                is_public: false,
            })
            .select()
            .single();

        if (error) {
            // 중복 키 오류는 정상 (이미 샘플이 생성된 경우)
            if (error.code === '23505') {
                sampleLogger('샘플 페이지가 이미 존재함 (정상)', { userId, samplePageId });
                return;
            }

            // 그 외 오류는 로깅하고 조용히 실패
            sampleLogger('샘플 페이지 생성 실패', { error, userId });
            captureException(error);
            return;
        }

        sampleLogger('샘플 페이지 생성 완료', {
            pageId: data?.id,
            userId,
            title,
        });
    } catch (error) {
        // 샘플 페이지 생성 실패는 사용자 경험에 치명적이지 않으므로 조용히 실패
        sampleLogger('샘플 페이지 생성 중 예외 발생', { error, userId });
    }
}

/**
 * 사용자 ID 기반 결정적 ID 생성
 *
 * user_id에 고정 문자열을 추가하여 ULID 형식의 ID 생성
 * 동일한 user_id에 대해 항상 동일한 ID를 반환
 *
 * @param userId 사용자 ID
 * @returns 결정적 샘플 페이지 ID
 */
const ULID_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const REQUIRED_BITS = 26 * 5; // ULID는 26자(각 5비트)로 구성

/**
 * 사용자 ID 기반 결정적 ID 생성
 *
 * user_id를 SHA-256으로 해싱한 후 ULID 알파벳으로 변환하여
 * 항상 동일한 26자리 문자열을 반환합니다.
 *
 * @param userId 사용자 ID
 * @returns 결정적 샘플 페이지 ID
 */
export function createDeterministicSamplePageId(userId: string): string {
    const hash = createHash('sha256').update(`sample:${userId}`).digest();

    return convertHashToUlid(hash);
}

function convertHashToUlid(hash: Buffer): string {
    let bitString = '';

    for (const byte of hash) {
        bitString += byte.toString(2).padStart(8, '0');
        if (bitString.length >= REQUIRED_BITS) {
            break;
        }
    }

    if (bitString.length < REQUIRED_BITS) {
        bitString = bitString.padEnd(REQUIRED_BITS, '0');
    }

    let id = '';
    for (let i = 0; i < REQUIRED_BITS; i += 5) {
        const chunk = bitString.slice(i, i + 5);
        const index = parseInt(chunk, 2);
        id += ULID_ALPHABET[index] ?? ULID_ALPHABET[0];
    }

    return id;
}

/**
 * HTML에 data-block-id 속성을 추가
 * BlockNote 에디터가 블록 ID를 추적할 수 있도록 각 블록 요소에 ID 추가
 *
 * @param html HTML 문자열
 * @returns data-block-id가 추가된 HTML 문자열
 */
function addBlockIds(html: string): string {
    // 블록 레벨 요소들에 data-block-id 추가
    const blockTags = ['p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'ul', 'ol', 'li'];

    let result = html;

    blockTags.forEach((tag) => {
        // 열림 태그 찾기 (이미 data-block-id가 없는 경우에만)
        const regex = new RegExp(`<${tag}(?![^>]*data-block-id)([^>]*)>`, 'gi');
        result = result.replace(regex, (match, attrs) => {
            const blockId = ulid();
            return `<${tag}${attrs} data-block-id="${blockId}">`;
        });
    });

    return result;
}
