import React from 'react';
import Box from '@mui/material/Box';
import type { BoxProps } from '@mui/material/Box';
import styled from '@emotion/styled';

interface SvgPartProps extends BoxProps {
    positionX: number;
    positionY: number;
    width: string;
    height: string;
    imageUrl: string;
    className?: string;
}

export const SvgPart = styled(Box)<SvgPartProps>(
    ({ positionX, positionY, width, height, imageUrl, className }) => ({
        width: width,
        height: height,
        backgroundImage: `url(${imageUrl})`,
        backgroundPosition: `${positionX}px ${positionY}px`,
        backgroundRepeat: 'no-repeat',
    })
);
