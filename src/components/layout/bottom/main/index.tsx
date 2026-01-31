'use client';
import { chatLogger } from '@/debug/chat';
import React, { memo } from 'react';
import {
    isDarkModeAtom,
    resetSearchState,
    searchDialogState,
    noticeHistoryState,
    openConfirmState,
    scrollToTopState,
    focusGlobalInputState,
    isModifiedState,
    openFileUploaderState,
    fileUploaderOpenState,
    chatOpenState,
} from '@/lib/jotai';
import { ulid } from 'ulid';
import { useAtom, useAtomValue, useSetAtom } from 'jotai';
import { useState, useCallback, useMemo } from 'react';
import { navBottomLogger } from '@/debug/nav';
import Home from '@/public/icon/bottom_nav_home';
import Search from '@/public/icon/bottom_nav_search';
import Create from '@/public/icon/bottom_nav_create';
import Photo from '@/public/icon/bottom_nav_photo';
import Ai from '@/public/icon/bottom_nav_ai';
import { NavButton, NavButtonLabel } from '../NavButton';
import { requestHapticFeedback } from '@/utils/hapticFeedback';
import { useTranslations } from 'next-intl';

// RRD 리팩토링: legacy navigation 유틸 제거
import { useNavigate, useLocation, matchPath } from 'react-router-dom';

const ICON_SIZE = '22';

// 컴포넌트 외부에서 아이콘들을 미리 생성하여 참조 안정성 확보
const HomeIcon = <Home width={ICON_SIZE} height={ICON_SIZE} className="stroke-text-color block" />;
const SearchIcon = (
    <Search width={ICON_SIZE} height={ICON_SIZE} className="fill-text-color stroke-text-color" />
);
const CreateIcon = (
    <Create width={ICON_SIZE} height={ICON_SIZE} className="fill-text-color stroke-text-color" />
);
const PhotoIcon = (
    <Photo width={ICON_SIZE} height={ICON_SIZE} className="fill-text-color stroke-text-color" />
);
const AiIcon = (
    <Ai width={ICON_SIZE} height={ICON_SIZE} className="fill-text-color stroke-text-color" />
);

const MainNavigation = memo(function MainNavigation() {
    const t = useTranslations();
    const darkMode = useAtomValue(isDarkModeAtom);
    const [searchDialog, setSearchDialog] = useAtom(searchDialogState);
    const resetSearch = useSetAtom(resetSearchState);
    const [chatOpen, setChatOpen] = useAtom(chatOpenState);
    const location = useLocation();
    const [noticeHistory, setNoticeHistory] = useAtom(noticeHistoryState);
    const openConfirm = useSetAtom(openConfirmState);
    const scrollToTop = useSetAtom(scrollToTopState);
    const focusGlobalInput = useSetAtom(focusGlobalInputState);
    const [value, setValue] = useState(0);
    const isModified = useAtomValue(isModifiedState);
    const openFileUploader = useSetAtom(openFileUploaderState);
    const fileUploaderOpen = useAtomValue(fileUploaderOpenState);
    const setIsModified = useSetAtom(isModifiedState);
    const navigate = useNavigate();

    navBottomLogger('하단 네비 랜더링', {
        darkMode,
        searchDialog,
        path: location.pathname,
        noticeHistory,
        isModified,
    });

    const checkModifiedBeforeExit = useCallback(
        (callback: () => void) => {
            const latestIsModified = isModified;
            navBottomLogger('변경사항 체크', { path: location.pathname });

            if (latestIsModified) {
                navBottomLogger('변경사항 있음, 확인 필요');
                openConfirm({
                    message: t.markup('editor.unsaved-changes-warning', {
                        br: () => '<br />',
                    }),
                    yesLabel: t('editor.exit'),
                    noLabel: t('editor.cancel'),
                    onYes: () => {
                        setIsModified(false);
                        navBottomLogger('변경사항 무시하고 나가기, isModified false로 설정');
                        callback();
                    },
                    onNo: () => {
                        navBottomLogger('나가기 취소');
                    },
                });
            } else {
                callback();
            }
        },
        [location.pathname, isModified, openConfirm, t, setIsModified]
    );

    const homeHandler = useCallback(() => {
        navBottomLogger('홈 버튼 클릭');

        checkModifiedBeforeExit(() => {
            navBottomLogger('홈 페이지 이동', { path: location.pathname });
            scrollToTop({});
            navigate('/page');
            requestHapticFeedback();
        });
    }, [scrollToTop, navigate]);

    const searchHandler = useCallback(() => {
        navBottomLogger('검색 버튼 클릭');

        checkModifiedBeforeExit(() => {
            navBottomLogger('검색 다이얼로그 열기');
            requestAnimationFrame(() => {
                document.getElementById('mainScrollPane')?.scrollTo({
                    top: 0,
                    behavior: 'auto',
                });
            });
            resetSearch();
            navigate(`/search`);
            requestAnimationFrame(() => {
                focusGlobalInput('search');
            });
            requestHapticFeedback();
        });
    }, [resetSearch, focusGlobalInput, checkModifiedBeforeExit]);

    const createHandler = useCallback(() => {
        navBottomLogger('생성 버튼 클릭');

        checkModifiedBeforeExit(() => {
            const id = ulid();
            navBottomLogger('페이지 생성 이동', { id });
            // 현재 경로가 폴더 상세 페이지인 경우, 해당 폴더 내에서 페이지 생성
            const pathSegments = location.pathname.split('/');
            if (
                pathSegments[1] === 'home' &&
                pathSegments[2] === 'folder' &&
                pathSegments[3] &&
                !pathSegments[4]
            ) {
                const folderId = pathSegments[3];
                navBottomLogger('폴더 내 페이지 생성', { folderId, pageId: id });
                navigate(`/folder/${folderId}/${id}`);
            } else {
                navigate(`/page/${id}`);
            }
            requestHapticFeedback();
        });
    }, [checkModifiedBeforeExit, navigate]);

    const imageHandler = useCallback(() => {
        navBottomLogger('이미지 버튼 클릭');

        checkModifiedBeforeExit(() => {
            navBottomLogger('이미지 업로더 실행');
            openFileUploader({ open: false });
            requestAnimationFrame(() => {
                openFileUploader({ open: true });
            });
            requestHapticFeedback();
        });
    }, [
        noticeHistory,
        setNoticeHistory,
        openConfirm,
        openFileUploader,
        checkModifiedBeforeExit,
        t,
    ]);

    const chatHandler = useCallback(async () => {
        navBottomLogger('AI 버튼 클릭');
        setChatOpen((prev) => {
            chatLogger('🚀 ~ chatHandler ~ prev:', prev);
            return !prev;
        });
        requestHapticFeedback();
    }, [setChatOpen]);

    // 번역 텍스트들을 메모이제이션
    const translations = useMemo(
        () => ({
            home: t('navigation.home'),
            search: t('navigation.search'),
            write: t('navigation.write'),
            images: t('editor.images'),
            chat: t('navigation.chat'),
            cancel: t('editor.cancel'),
            login: t('loggedin-menu.login'),
            uploadWarning: t('chat.upload-anonymous-user-warning'),
        }),
        [t]
    );

    // 각 버튼의 onClick 핸들러들을 메모이제이션
    const buttonHandlers = useMemo(
        () => ({
            home: () => {
                setValue(0);
                homeHandler();
            },
            search: () => {
                setValue(1);
                searchHandler();
            },
            create: () => {
                setValue(2);
                createHandler();
            },
            image: () => {
                setValue(3);
                imageHandler();
            },
            chat: () => {
                setValue(4);
                chatHandler();
            },
        }),
        [
            homeHandler,
            searchHandler,
            createHandler,
            imageHandler,
            chatHandler,
            openConfirm,
            translations,
        ]
    );

    const navButtonProps = useMemo(
        () => [
            {
                // 홈(페이지/폴더 영역) 활성: 신규 경로(/page, /folder/*)와 구버전 경로(/home, /home/page/*)를 모두 지원
                isActive:
                    location.pathname === '/page' ||
                    location.pathname === '/page/' ||
                    location.pathname.startsWith('/page') ||
                    location.pathname.startsWith('/folder') ||
                    location.pathname === '/home' ||
                    location.pathname === '/home/' ||
                    location.pathname.startsWith('/home/page'),
                onClick: buttonHandlers.home,
                icon: HomeIcon,
                label: translations.home,
            },
            {
                // 검색 활성: 신규 경로(/search)와 구버전 경로(/home/search/*) 모두 지원
                isActive:
                    location.pathname === '/search' ||
                    location.pathname.startsWith('/search') ||
                    location.pathname === '/home/search' ||
                    location.pathname.startsWith('/home/search'),
                onClick: buttonHandlers.search,
                icon: SearchIcon,
                label: translations.search,
            },
            {
                isActive: false,
                onClick: buttonHandlers.create,
                icon: CreateIcon,
                label: translations.write,
            },
            {
                isActive: false,
                onClick: buttonHandlers.image,
                icon: PhotoIcon,
                label: translations.images,
            },
            {
                isActive: chatOpen,
                onClick: buttonHandlers.chat,
                icon: AiIcon,
                label: translations.chat,
            },
        ],
        [location.pathname, chatOpen, buttonHandlers, translations]
    );

    return (
        <div id="bottomNav" className="pt-[10px]">
            <div
                style={{
                    height: '65px',
                    width: '100%',
                    maxWidth: '680px',
                    bottom: 0,
                    left: 0,
                    backgroundColor: 'transparent',
                    display: 'flex',
                    justifyContent: 'space-around',
                    alignItems: 'center',
                }}
            >
                {navButtonProps.map((props, index) => (
                    <NavButton key={index} onClick={props.onClick} isActive={props.isActive}>
                        {props.icon}
                        <NavButtonLabel>{props.label}</NavButtonLabel>
                    </NavButton>
                ))}
            </div>
        </div>
    );

    function runUploader() {
        navBottomLogger('업로더 실행');
        resetSearch();
        navigate('/page');
        requestAnimationFrame(() => {
            window.scrollTo(0, 0);
            // @ts-ignore
            document.querySelector('#uploaderctx')?.getAPI().initFlow();
        });
    }
});

export default MainNavigation;
