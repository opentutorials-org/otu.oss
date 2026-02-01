'use client';

import React, { Component, ReactNode } from 'react';
import Button from '@mui/material/Button';
import { useLingui } from '@lingui/react/macro';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

/**
 * Discriminated union 타입으로 에러 상태를 명확하게 표현
 * hasError가 true일 때만 error가 존재함을 타입으로 보장
 */
type ErrorBoundaryState = { hasError: false; error: null } | { hasError: true; error: Error };

interface ErrorFallbackUIProps {
    error: Error;
    onRetry: () => void;
}

/**
 * 에러 발생 시 표시되는 fallback UI 컴포넌트
 * 함수형 컴포넌트로 분리하여 useLingui 훅 사용 가능
 */
function ErrorFallbackUI({ error, onRetry }: ErrorFallbackUIProps) {
    const { t } = useLingui();

    return (
        <div className="flex flex-col items-center justify-center h-32 text-gray-500 p-4">
            <p className="mb-2 text-center">{t`오류가 발생했습니다`}</p>
            <p className="text-sm text-gray-400 mb-4 text-center">
                {error.message || t`알 수 없는 오류`}
            </p>
            <Button variant="outlined" size="small" onClick={onRetry}>
                {t`다시 시도`}
            </Button>
        </div>
    );
}

/**
 * React Error Boundary 컴포넌트
 * 자식 컴포넌트에서 발생한 에러를 캐치하여 앱 크래시를 방지
 */
export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
    constructor(props: ErrorBoundaryProps) {
        super(props);
        this.state = { hasError: false, error: null };
    }

    static getDerivedStateFromError(error: Error): ErrorBoundaryState {
        return { hasError: true, error };
    }

    componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
        console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    handleRetry = () => {
        this.setState({ hasError: false, error: null });
    };

    render() {
        if (this.state.hasError) {
            if (this.props.fallback) {
                return this.props.fallback;
            }

            return <ErrorFallbackUI error={this.state.error} onRetry={this.handleRetry} />;
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
