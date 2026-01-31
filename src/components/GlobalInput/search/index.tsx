import { isDarkModeAtom } from '@/lib/jotai';
import CloseIcon from '@mui/icons-material/Close';
import IconButton from '@mui/material/IconButton';
import { useAtomValue } from 'jotai';
import Image from 'next/image';
import { useEffect, useRef, useState } from 'react';
import TextArea from '../TextArea';
import Wrapper from '../wrapper';
import { useTranslations } from 'next-intl';
import Search from '@/public/icon/search';
import { useLocation, useNavigate } from 'react-router-dom';
export default function Index() {
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const darkMode = useAtomValue(isDarkModeAtom);
    const displayValue = (() => {
        if (!pathname) return '';
        const match = pathname.match(/^\/(?:home\/)?search(?:\/([^/]+))?/);
        return match && match[1] ? decodeURIComponent(match[1]) : '';
    })();

    return (
        <div>
            <div
                className="max-w-[250px] min-w-[100px] w-[100%] text-[#6d6d6d] dark:text-white text-[0.8rem] cursor-text pt-2"
                style={{ display: 'grid', gridTemplateColumns: '14px auto 20px' }}
            >
                <Image
                    src={`/${darkMode ? 'dark' : 'light'}/search_icon.svg`}
                    width="14"
                    height="14"
                    alt={'logo'}
                    priority
                />
                <div
                    onClick={() => {
                        if (!pathname || !pathname.endsWith('/search')) {
                            navigate('/search');
                        }
                    }}
                    className="ml-1 pb-1 truncate border-b-[1px] border-b-[#737373] h-[15px] text-[10px]"
                >
                    {displayValue}
                </div>
                {displayValue.length > 0 && (
                    <CloseIcon
                        className="text-[1rem] cursor-pointer mr-2"
                        sx={{ width: 14, height: 14 }}
                        onClick={() => {
                            navigate('/search', { replace: true });
                        }}
                    ></CloseIcon>
                )}
            </div>
        </div>
    );
}

export function SearchInput() {
    const { pathname } = useLocation();
    const [value, setValue] = useState('');
    const darkMode = useAtomValue(isDarkModeAtom);
    const t = useTranslations('editor');
    const valueRef = useRef(value);
    valueRef.current = value;
    const navigate = useNavigate();

    function onClose() {
        navigate('/page');
    }
    useEffect(() => {
        // @ts-ignore
        const handleKeyDown = (event) => {
            if (event.key === 'Escape') {
                onClose();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => {
            window.removeEventListener('keydown', handleKeyDown);
        };
    }, []);

    useEffect(() => {
        if (pathname && (/^\/home\/search/.test(pathname) || /^\/search/.test(pathname))) {
            try {
                const match = pathname.match(/^\/(?:home\/)?search(?:\/([^/]+))?/);
                const key = match && match[1] ? decodeURIComponent(match[1]) : '';
                setValue(key);
            } catch {}
        } else {
            setValue('');
        }
    }, [pathname]);
    // @ts-ignore
    const enterHandler = (e) => {
        if (e.key === 'Enter') {
            const newUrl =
                value && value.trim().length > 0
                    ? `/search/${encodeURIComponent(value.trim())}`
                    : '/search';
            e.preventDefault();
            navigate(newUrl);
        }
    };

    const changeHandler = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setValue(newValue);
    };

    return (
        <div>
            <Wrapper>
                <div>
                    <Search width="16" className="fill-text-color" />
                </div>
                <TextArea
                    mode="search"
                    value={value}
                    placeholder={t('search.keyword')}
                    onChange={changeHandler}
                    onEnter={enterHandler}
                    onBlur={() => {}}
                />
                <IconButton onClick={onClose} sx={{ padding: 0.6 }}>
                    <CloseIcon className="text-color text-[0.6em]color" />
                </IconButton>
            </Wrapper>
            {null}
        </div>
    );
}
