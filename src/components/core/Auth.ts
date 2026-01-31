import { useRouter } from 'next/navigation';
import { useEffect } from 'react';

export function useCheckHomeAuth() {
    const router = useRouter();

    useEffect(() => {
        // 결제 기능 제거로 사용량 체크 불필요
        // 오픈소스 버전에서는 각자 자신의 API 키를 사용
    }, []);

    return null;
}
