/**
 * Snackbar 중복 렌더링 테스트
 * 이슈 #1130: /home/* 경로에서 Snackbar가 중복으로 표시되는 문제
 *
 * 수정 내용:
 * - RootLayoutProvider에서 Snackbar 제거
 * - GlobalUI의 조건부 lazy loading Snackbar만 사용
 */

import { testLogger } from '@/debug/test';
import '@testing-library/jest-dom';

describe('Snackbar 중복 렌더링 방지', () => {
    beforeEach(() => {
        testLogger('테스트 환경 초기화 완료');
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    test('RootLayoutProvider는 Snackbar를 렌더링하지 않아야 한다', () => {
        // Given: RootLayoutProvider 소스 코드
        const fs = require('fs');
        const path = require('path');
        const rootLayoutProviderPath = path.join(process.cwd(), 'app/RootLayoutProvider.tsx');
        const content = fs.readFileSync(rootLayoutProviderPath, 'utf-8');

        testLogger('RootLayoutProvider.tsx 내용 확인');

        // When & Then: Snackbar import가 없어야 함
        expect(content).not.toContain("import Snackbar from '@/components/common/Snackbar'");
        expect(content).not.toContain('<Snackbar />');

        testLogger('✓ RootLayoutProvider에 Snackbar가 없음을 확인');
    });

    test('GlobalUI는 조건부로 Snackbar를 렌더링해야 한다', () => {
        // Given: GlobalUI 소스 코드
        const fs = require('fs');
        const path = require('path');
        const globalUIPath = path.join(process.cwd(), 'src/components/core/GlobalUI.tsx');
        const content = fs.readFileSync(globalUIPath, 'utf-8');

        testLogger('GlobalUI.tsx 내용 확인');

        // When & Then: 조건부 lazy loading Snackbar가 있어야 함
        expect(content).toContain('snackbar.open && <Snackbar />');
        expect(content).toContain(
            "const Snackbar = lazy(() => import('@/components/common/Snackbar'))"
        );

        testLogger('✓ GlobalUI에 조건부 Snackbar가 있음을 확인');
    });

    test('app/(ui)/layout.tsx에 미사용 GlobalUI import가 없어야 한다', () => {
        // Given: app/(ui)/layout.tsx 소스 코드
        const fs = require('fs');
        const path = require('path');
        const layoutPath = path.join(process.cwd(), 'app/(ui)/layout.tsx');
        const content = fs.readFileSync(layoutPath, 'utf-8');

        testLogger('app/(ui)/layout.tsx 내용 확인');

        // When & Then: GlobalUI import가 없어야 함
        expect(content).not.toContain("import GlobalUI from '@/components/core/GlobalUI'");
        expect(content).not.toContain('<GlobalUI');

        testLogger('✓ app/(ui)/layout.tsx에 미사용 GlobalUI import가 없음을 확인');
    });

    test('Snackbar 컴포넌트는 createPortal을 사용하여 body에 렌더링해야 한다', () => {
        // Given: Snackbar 컴포넌트 소스 코드
        const fs = require('fs');
        const path = require('path');
        const snackbarPath = path.join(process.cwd(), 'src/components/common/Snackbar/index.tsx');
        const content = fs.readFileSync(snackbarPath, 'utf-8');

        testLogger('Snackbar/index.tsx 내용 확인');

        // When & Then: createPortal 사용 확인
        expect(content).toContain('createPortal');
        expect(content).toContain('document.body');

        testLogger('✓ Snackbar가 createPortal을 사용하여 중복 방지 구조임을 확인');
    });
});

describe('Snackbar 아키텍처 검증', () => {
    test('전체 아키텍처: RootLayoutProvider -> GlobalUI 책임 분리', () => {
        // Given: 2024년 2월 리팩토링 목표
        // "전역 설정이 불필요하게 광범위하게 적용되는 범위를 줄이는 것"

        testLogger('=== Snackbar 아키텍처 검증 ===');

        const fs = require('fs');
        const path = require('path');

        // RootLayoutProvider: 테마 관리만 담당
        const rootLayoutPath = path.join(process.cwd(), 'app/RootLayoutProvider.tsx');
        const rootLayoutContent = fs.readFileSync(rootLayoutPath, 'utf-8');

        // GlobalUI: 전역 UI 요소 담당 (Snackbar, ConfirmDialog 등)
        const globalUIPath = path.join(process.cwd(), 'src/components/core/GlobalUI.tsx');
        const globalUIContent = fs.readFileSync(globalUIPath, 'utf-8');

        // Then: 책임 분리 확인
        expect(rootLayoutContent).toContain('themeModeState');
        expect(rootLayoutContent).not.toContain('Snackbar');

        expect(globalUIContent).toContain('snackbarState');
        expect(globalUIContent).toContain('confirmState');

        testLogger('✓ RootLayoutProvider: 테마 관리');
        testLogger('✓ GlobalUI: 전역 UI 요소 (Snackbar, ConfirmDialog 등)');
        testLogger('아키텍처 검증 완료');
    });
});
