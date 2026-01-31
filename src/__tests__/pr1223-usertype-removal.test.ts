/** @jest-environment node */
/**
 * PR #1223 크로스 체크 테스트
 *
 * 목적: userType/마이그레이션 기능 제거 후 시스템 안정성 검증
 * 검증 항목:
 * 1. 제거된 함수/타입이 코드베이스에서 참조되지 않음
 * 2. 동기화 Control 함수가 매개변수 없이 동작
 * 3. 스키마에 page_offline 테이블이 없음
 */

import { describe, test, expect } from '@jest/globals';
import * as fs from 'fs';
import * as path from 'path';

describe('PR #1223 - userType 제거 검증', () => {
    test('types.ts에 userType, ANONYMOUS, NAMED가 없어야 함', () => {
        const typesPath = path.join(process.cwd(), 'src/types/index.ts');
        const content = fs.readFileSync(typesPath, 'utf-8');

        expect(content).not.toMatch(/export type userType/);
        expect(content).not.toMatch(/export const ANONYMOUS/);
        expect(content).not.toMatch(/export const NAMED/);
    });

    test('getUserType.ts 파일이 존재하지 않아야 함', () => {
        const filePath = path.join(process.cwd(), 'src/functions/getUserType.ts');
        expect(fs.existsSync(filePath)).toBe(false);
    });

    test('PageOffline.ts 모델 파일이 존재하지 않아야 함', () => {
        const filePath = path.join(process.cwd(), 'src/watermelondb/model/PageOffline.ts');
        expect(fs.existsSync(filePath)).toBe(false);
    });

    test('migration 페이지가 존재하지 않아야 함', () => {
        const migrationPage = path.join(process.cwd(), 'app/(ui)/migration/page.tsx');
        const switchPage = path.join(process.cwd(), 'app/(ui)/switchOnlineUser/page.tsx');

        expect(fs.existsSync(migrationPage)).toBe(false);
        expect(fs.existsSync(switchPage)).toBe(false);
    });

    test('스키마에 page_offline 테이블이 없어야 함', () => {
        const schemaPath = path.join(process.cwd(), 'src/watermelondb/schema.ts');
        const content = fs.readFileSync(schemaPath, 'utf-8');

        // tableSchema 정의에서 page_offline이 없어야 함
        expect(content).not.toMatch(/tableSchema\(\s*{\s*name:\s*['"]page_offline['"]/);
    });

    test('WatermelonDB index에서 PageOffline 모델이 제거되어야 함', () => {
        const indexPath = path.join(process.cwd(), 'src/watermelondb/index.ts');
        const content = fs.readFileSync(indexPath, 'utf-8');

        expect(content).not.toMatch(/import.*PageOffline/);
        expect(content).not.toMatch(/PageOffline/);
    });
});

describe('PR #1223 - 잔존 참조 검증', () => {
    /**
     * 재귀적으로 디렉토리를 순회하며 파일 내용을 검사
     */
    const checkDirForPattern = (
        dirPath: string,
        pattern: RegExp,
        excludeDirs: string[] = ['node_modules', '__tests__', '.next', 'dist']
    ): string[] => {
        const matches: string[] = [];

        const checkDir = (currentPath: string) => {
            const items = fs.readdirSync(currentPath);
            items.forEach((item) => {
                const itemPath = path.join(currentPath, item);
                const stat = fs.statSync(itemPath);

                if (stat.isDirectory() && !excludeDirs.includes(item)) {
                    checkDir(itemPath);
                } else if (item.endsWith('.ts') || item.endsWith('.tsx')) {
                    const content = fs.readFileSync(itemPath, 'utf-8');
                    if (pattern.test(content)) {
                        matches.push(itemPath);
                    }
                }
            });
        };

        if (fs.existsSync(dirPath)) {
            checkDir(dirPath);
        }

        return matches;
    };

    test('loginMode 함수가 소스 코드에서 사용되지 않아야 함', () => {
        const srcDirs = ['src/components', 'src/functions', 'app', 'src/watermelondb'];
        const allMatches: string[] = [];

        srcDirs.forEach((dir) => {
            const dirPath = path.join(process.cwd(), dir);
            const matches = checkDirForPattern(dirPath, /loginMode\(/);
            allMatches.push(...matches);
        });

        expect(allMatches).toEqual([]);
    });

    test('getUserType 함수가 소스 코드에서 import되지 않아야 함', () => {
        const srcDirs = ['src/components', 'src/functions', 'app', 'src/watermelondb'];
        const allMatches: string[] = [];

        srcDirs.forEach((dir) => {
            const dirPath = path.join(process.cwd(), dir);
            const matches = checkDirForPattern(dirPath, /import.*getUserType/);
            allMatches.push(...matches);
        });

        expect(allMatches).toEqual([]);
    });

    test('ANONYMOUS, NAMED 상수가 소스 코드에서 import되지 않아야 함', () => {
        const srcDirs = ['src/components', 'src/functions', 'app', 'src/watermelondb'];
        const allMatches: string[] = [];

        srcDirs.forEach((dir) => {
            const dirPath = path.join(process.cwd(), dir);
            // types.ts에서 ANONYMOUS나 NAMED를 import하는 패턴
            const matches = checkDirForPattern(
                dirPath,
                /import\s*{[^}]*(ANONYMOUS|NAMED)[^}]*}\s*from\s*['"]@?\/types['"]/
            );
            allMatches.push(...matches);
        });

        expect(allMatches).toEqual([]);
    });
});

describe('PR #1223 - 동기화 시스템 검증', () => {
    test('sync.ts에서 userType 관련 코드가 없어야 함', () => {
        const syncPath = path.join(process.cwd(), 'src/watermelondb/sync.ts');
        const content = fs.readFileSync(syncPath, 'utf-8');

        expect(content).not.toMatch(/userType/);
        expect(content).not.toMatch(/ANONYMOUS/);
        expect(content).not.toMatch(/NAMED/);
    });

    test('Page Control에서 isOnlineUser 매개변수가 없어야 함', () => {
        const pagePath = path.join(process.cwd(), 'src/watermelondb/control/Page.ts');
        const content = fs.readFileSync(pagePath, 'utf-8');

        // isOnlineUser 매개변수가 함수 시그니처에 없어야 함
        expect(content).not.toMatch(/isOnlineUser:\s*(boolean|userType)/);
    });

    test('useSync 훅에서 userType 관련 코드가 없어야 함', () => {
        const useSyncPath = path.join(process.cwd(), 'src/functions/hooks/useSync.tsx');
        const content = fs.readFileSync(useSyncPath, 'utf-8');

        expect(content).not.toMatch(/getUserType/);
        expect(content).not.toMatch(/userType/);
    });
});
