import Link from 'next/link';

type ErrorPagePropsType = {
    message: string;
    back?: {
        href: string;
        title: string;
    };
};

export function ErrorPage({ message, back = { title: 'home', href: '/' } }: ErrorPagePropsType) {
    return (
        <article>
            <h1>{message}</h1>
            <Link href={back.href}>{back.title}</Link>
        </article>
    );
}
