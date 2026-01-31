import React, { ComponentType, useState, useEffect, useRef } from 'react';

// Framer Motion types removal
export interface MotionEffectsConfig {
    // 호버 효과 설정
    hover?: {
        scale?: number;
        y?: number;
        x?: number;
        rotate?: number;
        opacity?: number;
    };
    // 탭 효과 설정
    tap?: {
        scale?: number;
        y?: number;
        x?: number;
        rotate?: number;
        opacity?: number;
    };
    // 초기 애니메이션 설정
    initial?: {
        opacity?: number;
        y?: number;
        x?: number;
        scale?: number;
        rotate?: number;
    };
    // 진입 애니메이션 설정
    animate?: {
        opacity?: number;
        y?: number;
        x?: number;
        scale?: number;
        rotate?: number;
    };
    // 트랜지션 설정 (Note: Native CSS implementation ignores complex spring physics)
    transition?: {
        duration?: number;
        ease?: string;
        type?: string;
        stiffness?: number;
        damping?: number;
    };
    // 비활성화 상태에서 애니메이션 제한
    disableWhenDisabled?: boolean;
}

export interface WithMotionEffectsProps {
    disabled?: boolean;
    motionConfig?: MotionEffectsConfig;
}

// 기본 설정값
// NOTE: initial.opacity를 1로 설정하여 컴포넌트가 처음부터 보이도록 함
// 진입 애니메이션이 필요한 경우 개별 프리셋에서 opacity: 0을 명시적으로 설정
const defaultConfig: MotionEffectsConfig = {
    hover: {
        scale: 1.05,
    },
    tap: {
        scale: 0.95,
    },
    initial: {
        opacity: 1,
        y: 0,
    },
    animate: {
        opacity: 1,
        y: 0,
    },
    transition: {
        duration: 0.2,
        ease: 'ease-out',
    },
    disableWhenDisabled: true,
};

/**
 * 컴포넌트에 Motion 효과를 추가하는 HOC
 * Native CSS Implementation
 */
export function withMotionEffects<P extends object>(
    WrappedComponent: ComponentType<P>,
    config: MotionEffectsConfig = {}
) {
    const MotionEnhancedComponent = React.forwardRef<
        HTMLDivElement,
        React.ComponentPropsWithoutRef<'div'> & P & WithMotionEffectsProps
    >((props, ref) => {
        const { disabled = false, motionConfig, ...restProps } = props;

        const [isHovered, setIsHovered] = useState(false);
        const [isPressed, setIsPressed] = useState(false);
        const [hasMounted, setHasMounted] = useState(false);

        // 알려진 DOM props들을 분리
        const domPropKeys = [
            'className',
            'style',
            'id',
            'onClick',
            'onMouseEnter',
            'onMouseLeave',
            'onMouseDown',
            'onMouseUp',
            'onFocus',
            'onBlur',
            'tabIndex',
            'role',
        ];

        const domProps: any = {};
        const componentProps: any = {};

        // props를 DOM props와 컴포넌트 props로 분리
        Object.keys(restProps).forEach((key) => {
            if (domPropKeys.includes(key) || key.startsWith('data-') || key.startsWith('aria-')) {
                // onClick 이벤트는 컴포넌트에만 전달하여 중복 실행 방지
                if (key === 'onClick') {
                    componentProps[key] = (restProps as any)[key];
                } else {
                    domProps[key] = (restProps as any)[key];
                }
            } else {
                componentProps[key] = (restProps as any)[key];
            }
        });

        // 설정 병합 (기본값 -> HOC 설정 -> props 설정 순으로 우선순위)
        const finalConfig = {
            ...defaultConfig,
            ...config,
            ...motionConfig,
        };

        const shouldDisable = disabled && finalConfig.disableWhenDisabled;

        // Entrance animation logic
        useEffect(() => {
            // Trigger animation after mount
            const timer = setTimeout(() => {
                setHasMounted(true);
            }, 50);
            return () => clearTimeout(timer);
        }, []);

        // Calculate styles
        const getTransform = () => {
            let scale = 1;
            let x = 0;
            let y = 0;
            let rotate = 0;
            let opacity = 1;

            // Base state (initial vs animate)
            if (!hasMounted && finalConfig.initial) {
                if (finalConfig.initial.scale !== undefined) scale = finalConfig.initial.scale;
                if (finalConfig.initial.x !== undefined) x = finalConfig.initial.x;
                if (finalConfig.initial.y !== undefined) y = finalConfig.initial.y;
                if (finalConfig.initial.rotate !== undefined) rotate = finalConfig.initial.rotate;
                if (finalConfig.initial.opacity !== undefined)
                    opacity = finalConfig.initial.opacity;
            } else if (hasMounted && finalConfig.animate) {
                if (finalConfig.animate.scale !== undefined) scale = finalConfig.animate.scale;
                if (finalConfig.animate.x !== undefined) x = finalConfig.animate.x;
                if (finalConfig.animate.y !== undefined) y = finalConfig.animate.y;
                if (finalConfig.animate.rotate !== undefined) rotate = finalConfig.animate.rotate;
                if (finalConfig.animate.opacity !== undefined)
                    opacity = finalConfig.animate.opacity;
            }

            // Interaction states override base state
            if (!shouldDisable) {
                if (isPressed && finalConfig.tap) {
                    if (finalConfig.tap.scale !== undefined) scale = finalConfig.tap.scale;
                    if (finalConfig.tap.x !== undefined) x = finalConfig.tap.x;
                    if (finalConfig.tap.y !== undefined) y = finalConfig.tap.y;
                    if (finalConfig.tap.rotate !== undefined) rotate = finalConfig.tap.rotate;
                    if (finalConfig.tap.opacity !== undefined) opacity = finalConfig.tap.opacity;
                } else if (isHovered && finalConfig.hover) {
                    if (finalConfig.hover.scale !== undefined) scale = finalConfig.hover.scale;
                    if (finalConfig.hover.x !== undefined) x = finalConfig.hover.x;
                    if (finalConfig.hover.y !== undefined) y = finalConfig.hover.y;
                    if (finalConfig.hover.rotate !== undefined) rotate = finalConfig.hover.rotate;
                    if (finalConfig.hover.opacity !== undefined)
                        opacity = finalConfig.hover.opacity;
                }
            }

            return {
                transform: `translate3d(${x}px, ${y}px, 0) scale(${scale}) rotate(${rotate}deg)`,
                opacity,
            };
        };

        const computedStyle = getTransform();
        const transitionDuration = finalConfig.transition?.duration
            ? `${finalConfig.transition.duration}s`
            : '0.2s';

        const transitionStyle = {
            transition: `transform ${transitionDuration} ease-out, opacity ${transitionDuration} ease-out`,
            willChange: 'transform, opacity',
            display: 'inline-block', // Default display for motion.div replacement
            ...computedStyle,
            ...domProps.style,
        };

        const handleMouseEnter = (e: React.MouseEvent) => {
            setIsHovered(true);
            domProps.onMouseEnter?.(e);
        };

        const handleMouseLeave = (e: React.MouseEvent) => {
            setIsHovered(false);
            setIsPressed(false);
            domProps.onMouseLeave?.(e);
        };

        const handleMouseDown = (e: React.MouseEvent) => {
            setIsPressed(true);
            domProps.onMouseDown?.(e);
        };

        const handleMouseUp = (e: React.MouseEvent) => {
            setIsPressed(false);
            domProps.onMouseUp?.(e);
        };

        return (
            <div
                ref={ref}
                {...domProps}
                style={transitionStyle}
                onMouseEnter={handleMouseEnter}
                onMouseLeave={handleMouseLeave}
                onMouseDown={handleMouseDown}
                onMouseUp={handleMouseUp}
            >
                <WrappedComponent {...(componentProps as P)} disabled={disabled} />
            </div>
        );
    });

    MotionEnhancedComponent.displayName = `withMotionEffects(${
        WrappedComponent.displayName || WrappedComponent.name || 'Component'
    })`;

    return MotionEnhancedComponent;
}

// 사전 정의된 Motion 효과들
export const motionPresets = {
    // 기본 버튼 효과 - 진입 애니메이션 제거하고 호버/탭 효과만 유지
    button: {
        hover: { scale: 1.05 },
        tap: { scale: 0.95 },
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.3 },
    },

    // 강한 탭 효과 (현재 ButtonBase에서 사용)
    strongTap: {
        hover: { scale: 1.1 },
        tap: { scale: 0.8 },
        initial: { opacity: 1, y: 0 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.2 },
    },

    // 카드 효과
    card: {
        hover: { y: -5, scale: 1.02 },
        tap: { scale: 0.98 },
        initial: { opacity: 0, y: 20 },
        animate: { opacity: 1, y: 0 },
        transition: { duration: 0.4 },
    },

    // 아이콘 효과
    icon: {
        hover: { rotate: 5, scale: 1.1 },
        tap: { scale: 1.2 },
        transition: { duration: 0.2 },
    },

    // 페이드 효과
    fade: {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration: 0.5 },
    },
} as const;

// 편의를 위한 사전 정의된 HOC들
export const withButtonMotion = (component: ComponentType<any>) =>
    withMotionEffects(component, motionPresets.button);

export const withStrongTapMotion = (component: ComponentType<any>) =>
    withMotionEffects(component, motionPresets.strongTap);

export const withCardMotion = (component: ComponentType<any>) =>
    withMotionEffects(component, motionPresets.card);

export const withIconMotion = (component: ComponentType<any>) =>
    withMotionEffects(component, motionPresets.icon);

export const withFadeMotion = (component: ComponentType<any>) =>
    withMotionEffects(component, motionPresets.fade);
