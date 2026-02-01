import { useState, useEffect } from 'react';
import s from '../style.module.css';
import { useRouter } from 'next/navigation';

const DebugInfo = () => {
    const [debugMode, setDebugMode] = useState(false);
    const [clickCount, setClickCount] = useState(0);
    const router = useRouter();

    useEffect(() => {
        if (window === undefined) return;
        // Check if debug mode is enabled in localStorage
        const isDebugMode = localStorage.getItem('OTU_debug') === 'true';
        setDebugMode(isDebugMode);
    }, []);

    const handleClick = () => {
        const newClickCount = clickCount + 1;
        setClickCount(newClickCount);

        if (newClickCount >= 5) {
            const newDebugMode = !debugMode;
            setDebugMode(newDebugMode);
            localStorage.setItem('OTU_debug', newDebugMode.toString());
            setClickCount(0);
            setTimeout(() => {
                location.reload();
            }, 100);
        }
    };

    return (
        <div className="min-h-[50px] overflow-x-auto" onClick={handleClick}>
            {debugMode && (
                <div className="p-4">
                    <h1>Deployment Information</h1>
                    <p>Environment: {process.env.NEXT_PUBLIC_VERCEL_ENV || 'N/A'}</p>
                    <p>Git Repo Slug: {process.env.NEXT_PUBLIC_VERCEL_GIT_REPO_SLUG || 'N/A'}</p>
                    <p>Git Commit Ref: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_REF || 'N/A'}</p>
                    <p>Git Commit SHA: {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_SHA || 'N/A'}</p>
                    <p>
                        Git Commit Message:{' '}
                        {process.env.NEXT_PUBLIC_VERCEL_GIT_COMMIT_MESSAGE || 'N/A'}
                    </p>
                </div>
            )}
        </div>
    );
};

export default DebugInfo;
