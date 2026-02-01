'use client';

import React, { Component, ReactNode } from 'react';
import Button from '@mui/material/Button';

interface ErrorBoundaryProps {
    children: ReactNode;
    fallback?: ReactNode;
}

interface ErrorBoundaryState {
    hasError: boolean;
    error: Error | null;
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

            return (
                <div className="flex flex-col items-center justify-center h-32 text-gray-500 p-4">
                    <p className="mb-2 text-center">오류가 발생했습니다</p>
                    <p className="text-sm text-gray-400 mb-4 text-center">
                        {this.state.error?.message || '알 수 없는 오류'}
                    </p>
                    <Button variant="outlined" size="small" onClick={this.handleRetry}>
                        다시 시도
                    </Button>
                </div>
            );
        }

        return this.props.children;
    }
}

export default ErrorBoundary;
