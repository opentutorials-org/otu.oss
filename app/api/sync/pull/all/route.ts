import { createClient } from '@/supabase/utils/server';
import { syncLogger } from '@/debug/sync';
import { type NextRequest, NextResponse } from 'next/server';
import { Database } from '@/lib/database/types';
import { TARGET_SIZE, MAX_LIMIT } from '@/functions/constants';

type Page = Database['public']['Tables']['page']['Row'];

function formatDate(date: Date): string {
    const pad = (n: number) => n.toString().padStart(2, '0');
    const year = date.getUTCFullYear();
    const month = pad(date.getUTCMonth() + 1);
    const day = pad(date.getUTCDate());
    const hours = pad(date.getUTCHours());
    const minutes = pad(date.getUTCMinutes());
    const seconds = pad(date.getUTCSeconds());
    const milliseconds = date.getUTCMilliseconds().toString().padStart(3, '0');
    return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}+00`;
}

export async function GET(req: NextRequest) {
    const startTime = Date.now();
    syncLogger('=== GET /api/sync/pull/all 시작 ===', { timestamp: new Date().toISOString() });

    const supabase = await createClient();
    const { data: userData, error: userError } = await supabase.auth.getUser();

    if (!userData.user || userError) {
        syncLogger('❌ 인증 실패', { userError, hasUser: !!userData.user });
        return new NextResponse('Unauthorized', { status: 401 });
    }

    const userId = userData.user.id;
    syncLogger('✅ 사용자 인증 성공', { userId: userId.substring(0, 8) + '...' });

    const searchParams = req.nextUrl.searchParams;
    const lastCreatedAtParam = searchParams.get('created_at');
    const lastId = searchParams.get('last_id');

    // 커서 파라미터 검증: 둘 중 하나만 있으면 안 됨
    if ((lastCreatedAtParam && !lastId) || (!lastCreatedAtParam && lastId)) {
        const errorMsg = 'Invalid cursor: both created_at and last_id are required';
        syncLogger('❌ 잘못된 커서 요청', { lastCreatedAtParam, lastId });
        return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    // lastCreatedAt 유효성 검사 및 정규화
    let lastCreatedAt: string | null = null;
    if (lastCreatedAtParam) {
        const date = new Date(decodeURIComponent(lastCreatedAtParam));
        if (isNaN(date.getTime())) {
            const errorMsg = 'Invalid created_at format';
            syncLogger('❌ 잘못된 날짜 형식', { lastCreatedAtParam });
            return NextResponse.json({ error: errorMsg }, { status: 400 });
        }
        // DB와 포맷을 맞추기 위해 재포맷팅할 수 있으나, 일단 ISO string 혹은 포맷터 사용
        // 여기서는 원본 값을 신뢰하되, 필요시 formatDate(date) 사용 가능.
        // 다만 클라이언트가 보낸 값을 그대로 사용하는 것이 커서 일치에 유리할 수 있음.
        lastCreatedAt = lastCreatedAtParam;
    }

    const isFirstPage = !lastCreatedAt && !lastId;

    syncLogger('📋 페이지네이션 파라미터', {
        lastCreatedAt,
        lastId: lastId?.substring(0, 8) + '...' || null,
        isFirstPage,
        maxLimit: MAX_LIMIT,
        targetSize: TARGET_SIZE, // 문자 수 기준, 제목+본문 최대값 (700,000자)
        searchParamsCount: Array.from(searchParams.keys()).length,
    });

    try {
        const queryStart = Date.now();
        syncLogger('🔍 Supabase RPC(get_dynamic_pages_chunk)를 사용한 페이지 데이터 조회 시작', {
            isFirstPage,
            cursorDate: lastCreatedAt,
            cursorId: lastId?.substring(0, 8) + '...' || null,
        });

        const { data: rpcResult, error: queryError } = await (supabase as any).rpc(
            'get_dynamic_pages_chunk',
            {
                last_created_at: lastCreatedAt || null,
                last_id: lastId || null,
                target_size: TARGET_SIZE, // 문자 수 기준, 제목+본문 최대값 (700,000자)
                max_limit: MAX_LIMIT,
            }
        );
        const queryDuration = Date.now() - queryStart;

        if (queryError) {
            syncLogger('❌ 페이지 데이터 쿼리 에러', {
                error: queryError,
                queryDuration: queryDuration + 'ms',
                errorCode: queryError.code,
                errorMessage: queryError.message,
                errorDetails: queryError.details,
            });
            throw queryError;
        }

        const result = rpcResult as { pages: Page[]; hasMore: boolean };
        const pagesData = result.pages || [];
        const hasMore = result.hasMore;

        // 폴더 데이터 조회 (첫 번째 페이지에서만)
        let folders: any[] = [];
        if (isFirstPage) {
            const folderQueryStart = Date.now();
            syncLogger('🔍 폴더 데이터 조회 시작', {
                userId: userId.substring(0, 8) + '...',
            });

            const { data: folderData, error: folderError } = await (supabase as any)
                .from('folder')
                .select(
                    'id, name, description, thumbnail_url, page_count, created_at, updated_at, last_page_added_at, user_id'
                )
                .eq('user_id', userId)
                .order('updated_at', { ascending: true });

            const folderQueryDuration = Date.now() - folderQueryStart;

            if (folderError) {
                syncLogger('❌ 폴더 데이터 쿼리 에러', {
                    error: folderError,
                    queryDuration: folderQueryDuration + 'ms',
                });
                throw folderError;
            }

            folders = folderData || [];
            syncLogger('✅ 폴더 데이터 조회 성공', {
                folderCount: folders.length,
                queryDuration: folderQueryDuration + 'ms',
            });
        }

        // 알람 데이터 조회 (첫 번째 페이지에서만)
        let alarms: any[] = [];
        if (isFirstPage) {
            const alarmQueryStart = Date.now();
            syncLogger('🔔 알람 데이터 조회 시작', {
                userId: userId.substring(0, 8) + '...',
            });

            const { data: alarmData, error: alarmError } = await supabase
                .from('alarm')
                .select(
                    'id, user_id, page_id, next_alarm_time, last_notification_id, sent_count, created_at, updated_at'
                )
                .eq('user_id', userId)
                .order('updated_at', { ascending: true });

            const alarmQueryDuration = Date.now() - alarmQueryStart;

            if (alarmError) {
                syncLogger('❌ 알람 데이터 쿼리 에러', {
                    error: alarmError,
                    queryDuration: alarmQueryDuration + 'ms',
                });
                throw alarmError;
            }

            alarms = alarmData || [];
            syncLogger('✅ 알람 데이터 조회 성공', {
                alarmCount: alarms.length,
                queryDuration: alarmQueryDuration + 'ms',
            });
        }

        const lastPage = pagesData.length > 0 ? pagesData[pagesData.length - 1] : null;
        let newLastCreatedAt = lastPage ? lastPage.created_at : lastCreatedAt;
        let newLastId = lastPage ? lastPage.id : lastId;

        // 데이터가 없을 때는 커서를 생성하지 않음 (일관성 유지)
        // hasMore: false이면 sync 루프가 종료되므로 커서 값이 필요 없음
        // 둘 다 null로 유지하여 커서 일관성 보장
        if (pagesData.length === 0 && isFirstPage) {
            newLastCreatedAt = null;
            newLastId = null;
            syncLogger('📅 데이터 없음 - 커서를 null로 설정', {
                reason: '데이터가 없고 첫 페이지이므로 커서 일관성 유지',
            });
        }

        // 데이터 분석
        // currentTotalSize: 누적된 페이지들의 문자 수 합계
        // page.length는 title.length + body.length로 저장되며, body는 원본 HTML 문자열(태그 포함)의 길이
        // 단위: 문자 수(character count), 바이트가 아님
        const currentTotalSize = pagesData.reduce(
            (sum: number, p: Page) =>
                sum + (p.length ?? (p.title?.length ?? 0) + (p.body?.length ?? 0)),
            0
        );

        // hasMore 로직:
        // DB 함수 get_dynamic_pages_chunk에서 정확하게 계산하여 반환함.
        // const hasMore = pagesData.length >= MAX_LIMIT || currentTotalSize >= TARGET_SIZE; // 기존 추측 로직 제거

        const dataAnalysis = {
            totalCount: pagesData.length,
            folderCount: folders.length,
            alarmCount: alarms.length,
            queryDuration: queryDuration + 'ms',
            avgQueryTime: pagesData.length
                ? (queryDuration / pagesData.length).toFixed(2) + 'ms/item'
                : 'N/A',
            hasMore,
            oldestDate: pagesData.length > 0 ? pagesData[0].created_at : null,
            newestDate: lastPage ? lastPage.created_at : null,
            pageSizes: pagesData.map((p: Page) => p.body?.length || 0), // 각 페이지의 본문 길이 (문자 수)
            totalBodySize: currentTotalSize, // 전체 누적 문자 수 (제목+본문 합계)
        };

        syncLogger('✅ Supabase에서 페이지 가져옴', dataAnalysis);

        // 페이지 타입별 분석
        const typeAnalysis = pagesData.reduce(
            (acc: Record<string, number>, page: Page) => {
                const pageType = page.type;
                acc[pageType] = (acc[pageType] || 0) + 1;
                return acc;
            },
            {} as Record<string, number>
        );

        if (Object.keys(typeAnalysis).length > 0) {
            syncLogger('📊 페이지 타입별 분석', typeAnalysis);
        }

        // 응답 데이터 준비
        const responseData = {
            pages: pagesData,
            folders: folders,
            alarms: alarms,
            created_at: newLastCreatedAt,
            lastId: newLastId,
            hasMore: hasMore, // 명시적으로 hasMore 반환
        };
        const responseSize = JSON.stringify(responseData).length;
        const totalDuration = Date.now() - startTime;

        syncLogger('=== GET /api/sync/pull/all 완료 ===', {
            success: true,
            totalDuration: totalDuration + 'ms',
            responseSize: responseSize + ' bytes',
            nextCursor: {
                created_at: newLastCreatedAt,
                lastId: newLastId?.substring(0, 8) + '...' || null,
            },
            hasMore: dataAnalysis.hasMore,
            includedFolders: folders.length,
            includedAlarms: alarms.length,
        });

        return new NextResponse(JSON.stringify(responseData), {
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-store, max-age=0', // 캐시 방지
            },
        });
    } catch (error: any) {
        const errorDuration = Date.now() - startTime;
        syncLogger('💥 Supabase 쿼리 오류 발생', {
            errorMessage: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            errorHint: error.hint,
            duration: errorDuration + 'ms',
            stack: error.stack?.split('\n').slice(0, 3),
            requestParams: {
                lastCreatedAt,
                lastId: lastId?.substring(0, 8) + '...' || null,
                isFirstPage,
            },
        });
        console.error('Supabase query error:', error);
        return NextResponse.json(
            { error: 'Internal Server Error' },
            {
                status: 500,
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-store, max-age=0',
                },
            }
        );
    } finally {
        const finalDuration = Date.now() - startTime;
        syncLogger('🏁 GET /api/sync/pull/all 요청 처리 완료', {
            totalDuration: finalDuration + 'ms',
            timestamp: new Date().toISOString(),
        });
    }
}
