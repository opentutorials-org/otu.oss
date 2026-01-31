import React from 'react';

interface CircleIconProps {
    className?: string;
    style?: React.CSSProperties;
}

/**
 * heroIcon의 CheckCircleIcon과 동일한 스타일의 원 아이콘
 * unchecked 상태를 나타내는 데 사용됩니다.
 */
export const CircleIcon: React.FC<CircleIconProps> = ({ className, style }) => (
    <svg
        className={className}
        xmlns="http://www.w3.org/2000/svg"
        fill="none"
        viewBox="0 0 24 24"
        strokeWidth={1.5}
        stroke="currentColor"
        style={style}
    >
        <circle cx="12" cy="12" r="9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
);

export default CircleIcon;
