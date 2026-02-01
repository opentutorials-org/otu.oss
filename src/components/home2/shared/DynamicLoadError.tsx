'use client';

import { Box, Button, Typography } from '@mui/material';
import { useLingui } from '@lingui/react/macro';

/**
 * Dynamic import 실패 시 표시되는 에러 컴포넌트
 * 사용자에게 에러 상황을 알리고 새로고침 옵션을 제공
 */
export default function DynamicLoadError() {
    const { t } = useLingui();

    const handleRefresh = () => {
        window.location.reload();
    };

    return (
        <Box
            sx={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                height: '100%',
                minHeight: 200,
                gap: 2,
                p: 3,
            }}
        >
            <Typography color="error">{t`컴포넌트를 불러오는 중 오류가 발생했습니다.`}</Typography>
            <Button variant="outlined" onClick={handleRefresh}>
                {t`새로고침`}
            </Button>
        </Box>
    );
}
