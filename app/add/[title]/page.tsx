'use client';
import { MuiThemeProvider } from '@/components/core/MuiThemeProvider';
import { Login } from '@/components/layout/Login';
import { useAtom } from 'jotai';
import { useParams, usePathname, useRouter } from 'next/navigation';
import { useEffect, use } from 'react';
import '@/app/globals.css';
import { createClient } from '@/supabase/utils/client';
import { useCreate } from '@/components/home2/editor/hooks/useCreate';
import { ulid } from 'ulid';
import { DELIMITER_TITLE_BODY } from '@/functions/constants';
import { parseTitleAndBody } from '@/components/GlobalInput/page/parseTitleAndBody';

export default function Page(props: { params: Promise<{ title: string }> }) {
    const params = use(props.params);
    const { editSubmitHandler } = useCreate();
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        (async () => {
            const supabase = createClient();
            const {
                data: { session },
            } = await supabase.auth.getSession();

            if (session === null) {
                router.push('/login?redirect=' + pathname);
            } else {
                const id = ulid();
                const { title: titlePart, body: bodyPart } = parseTitleAndBody(
                    decodeURIComponent(params.title)
                );
                const result = await editSubmitHandler(titlePart, bodyPart, false, id, 'text');
                router.push('/home/page/' + id);
            }
        })();
    }, []);

    return (
        <MuiThemeProvider>
            <div>
                <h1>{params.title}</h1>
                <p>This page is protected by a middleware that requires a valid session.</p>
                <Login></Login>
            </div>
        </MuiThemeProvider>
    );
}
