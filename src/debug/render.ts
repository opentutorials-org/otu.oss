//@ts-ignore
import debug from 'debug';
export const renderLogger = debug('render');
renderLogger.log = console.log.bind(console);

// 이전 의존성을 저장하기 위한 Map (WeakMap에서 일반 Map으로 변경)
const prevDepsCache = new Map<string, any[]>();
// 의존성 이름을 저장하기 위한 Map
const depsNamesCache = new Map<string, string[]>();

/**
 * 두 값이 동일한지 깊은 비교를 수행하는 함수
 * 객체와 배열의 경우 내용 기반으로 비교합니다
 */
const deepEqual = (a: any, b: any): boolean => {
    // 원시값이거나 null인 경우 직접 비교
    if (a === null || b === null || typeof a !== 'object' || typeof b !== 'object') {
        return Object.is(a, b);
    }

    // 둘 다 날짜 객체인 경우
    if (a instanceof Date && b instanceof Date) {
        return a.getTime() === b.getTime();
    }

    // 둘 다 정규식인 경우
    if (a instanceof RegExp && b instanceof RegExp) {
        return a.toString() === b.toString();
    }

    // 객체의 생성자가 다르면 다른 타입이므로 같지 않음
    if (a.constructor !== b.constructor) {
        return false;
    }

    // 배열인 경우
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        for (let i = 0; i < a.length; i++) {
            if (!deepEqual(a[i], b[i])) return false;
        }
        return true;
    }

    // 일반 객체인 경우
    const keysA = Object.keys(a);
    const keysB = Object.keys(b);

    if (keysA.length !== keysB.length) return false;

    // 모든 키가 존재하고 값이 일치하는지 확인
    return keysA.every(
        (key) => Object.prototype.hasOwnProperty.call(b, key) && deepEqual(a[key], b[key])
    );
};

// 변경 유형을 정의하는 상수
const CHANGE_TYPE = {
    NO_CHANGE: 'NO_CHANGE', // 변경 없음 (참조도 동일, 내용도 동일)
    REFERENCE_CHANGE: 'REFERENCE_CHANGE', // 참조만 변경 (내용은 동일)
    CONTENT_CHANGE: 'CONTENT_CHANGE', // 내용이 변경됨
    NEW_VALUE: 'NEW_VALUE', // 이전에 없던 새 값
};

/**
 * 컴포넌트의 렌더링 이유를 추적하는 확장 로거 함수
 *
 * @param {string} componentName - 로깅할 컴포넌트의 이름
 * @param {object} [props={}] - 컴포넌트에 전달된 props 객체
 * @param {any[]} [deps=[]] - 의존성 배열 (useEffect나 useCallback 등에서 사용하는 의존성과 유사)
 * @param {string[]} [depsNames=[]] - 의존성 배열의 각 항목 이름 (생략 시 자동으로 "deps[인덱스]"로 지정)
 * @returns {Function} - 해당 컴포넌트에 대한 디버그 로거 인스턴스
 *
 * @example
 * // 기본 사용법
 * enhancedRenderLogger('MyComponent', { id: 1, name: 'test' });
 *
 * @example
 * // 의존성과 함께 사용하면 렌더링 이유 추적 가능
 * enhancedRenderLogger('MyComponent', props, [
 *   someProp,
 *   someState,
 *   someValue
 * ], ['someProp', 'someState', 'someValue']);
 *
 * @example
 * // 컴포넌트 내부에서 사용 예시
 * function MyComponent({ id, name }) {
 *   const [state, setState] = useState(0);
 *
 *   enhancedRenderLogger('MyComponent', { id, name });
 *   // props가 자동으로 의존성 추적에 추가됩니다
 *
 *   return <div>{name}: {state}</div>;
 * }
 *
 * @description
 * 이 함수는 컴포넌트 렌더링시 로그를 출력하고, props 값을 보여줍니다.
 * 전달된 props는 자동으로 의존성 추적 대상이 되며, 추가 의존성 배열을 제공할 수도 있습니다.
 * 이전 렌더링과 비교하여 어떤 값이 변경되어 렌더링이 발생했는지 추적합니다.
 * 참조 변경과 실제 내용 변경을 모두 표시하여 더 정확한 디버깅을 지원합니다.
 *
 * 활성화 방법:
 * 브라우저 콘솔에서 `localStorage.debug = 'render:*'` 실행
 */
export const enhancedRenderLogger = (
    componentName: string,
    props: any = {},
    deps: any[] = [],
    depsNames: string[] = []
) => {
    const componentLogger = debug(`render:${componentName}`);
    const cacheKey = `render:${componentName}`;

    // 로그가 활성화된 경우에만 로직 실행
    if (!debug.enabled(`render:${componentName}`)) {
        return componentLogger;
    }

    componentLogger.log = console.log.bind(console);

    // 컴포넌트 렌더링 시 로그 출력
    componentLogger('[RENDER] ━━━━━━━━━━━━━━━━━━━━━━━━━━ 렌더링 발생 ━━━━━━━━━━━━━━━━━━━━━━━━━━');

    // props를 의존성 배열에 자동으로 추가
    const propsEntries = Object.entries(props);
    const allDeps = [...deps];
    const allDepsNames: string[] = [...depsNames];

    // 기존 deps에 이름이 누락된 경우 기본 이름 할당
    for (let i = allDepsNames.length; i < deps.length; i++) {
        allDepsNames.push(`deps[${i}]`);
    }

    // props를 의존성 배열에 추가
    propsEntries.forEach(([key, value]) => {
        allDeps.push(value);
        allDepsNames.push(`props.${key}`);
    });

    // 의존성 이름 저장
    depsNamesCache.set(cacheKey, allDepsNames);

    // 의존성 배열이 있는 경우 렌더링 원인 분석
    if (allDeps.length > 0) {
        const prevDepsRef = prevDepsCache.get(cacheKey) || [];
        const prevDepsNames = depsNamesCache.get(cacheKey) || allDepsNames;

        // 이전 값과 비교하여 변경된 항목 찾기
        const analyzedDeps = allDeps.map((dep, i) => {
            // 이전 값이 존재하는지 확인 (배열 길이도 함께 체크)
            const hasValidPrevValue = i < prevDepsRef.length;
            const prevValue = hasValidPrevValue ? prevDepsRef[i] : '(없음)';

            // 변경 유형 결정
            let changeType = CHANGE_TYPE.NO_CHANGE;

            if (!hasValidPrevValue) {
                // 이전 값이 없는 경우 (새 값)
                changeType = CHANGE_TYPE.NEW_VALUE;
            } else if (typeof dep === 'object' && dep !== null) {
                // 객체나 배열인 경우 참조와 내용 모두 확인
                const isSameReference = Object.is(dep, prevValue);
                const isSameContent = deepEqual(dep, prevValue);

                if (!isSameReference && !isSameContent) {
                    // 참조도 다르고 내용도 다름 (실제 변경)
                    changeType = CHANGE_TYPE.CONTENT_CHANGE;
                } else if (!isSameReference && isSameContent) {
                    // 참조는 다르지만 내용은 같음 (불필요한 렌더링 원인)
                    changeType = CHANGE_TYPE.REFERENCE_CHANGE;
                }
            } else if (!Object.is(dep, prevValue)) {
                // 원시 타입이고 값이 다름
                changeType = CHANGE_TYPE.CONTENT_CHANGE;
            }

            const name = i < allDepsNames.length ? allDepsNames[i] : `의존성[${i}]`;

            return {
                index: i,
                name,
                changeType,
                prevValue,
                currentValue: dep,
            };
        });

        // 참조나 내용이 변경된 의존성 필터링
        const changedDeps = analyzedDeps.filter(
            (item) => item.changeType !== CHANGE_TYPE.NO_CHANGE
        );

        if (changedDeps.length > 0) {
            // 변경 유형별로 그룹화
            const contentChanges = changedDeps.filter(
                (item) =>
                    item.changeType === CHANGE_TYPE.CONTENT_CHANGE ||
                    item.changeType === CHANGE_TYPE.NEW_VALUE
            );
            const referenceChanges = changedDeps.filter(
                (item) => item.changeType === CHANGE_TYPE.REFERENCE_CHANGE
            );

            const valueSummary = (val: any) => {
                if (val === null) return 'null';
                if (val === undefined) return 'undefined';
                if (val === '(없음)') return '(없음)';
                if (typeof val === 'function') return 'Function';
                if (typeof val === 'object') {
                    try {
                        const jsonStr = JSON.stringify(val);
                        return jsonStr.substring(0, 50) + (jsonStr.length > 50 ? '...' : '');
                    } catch (e) {
                        return `${val?.constructor?.name || 'Unknown'} 객체`;
                    }
                }
                return String(val);
            };

            // 내용 변경이 있는 경우 (실제 변경)
            if (contentChanges.length > 0) {
                componentLogger('▼ 내용 변경된 의존성 ▼');
                componentLogger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                contentChanges.forEach((item) => {
                    componentLogger(
                        `【${item.name}】 ${valueSummary(item.prevValue)} ──→ ${valueSummary(item.currentValue)}`
                    );
                });
                componentLogger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }

            // 참조만 변경된 경우 (불필요한 렌더링 원인일 가능성)
            if (referenceChanges.length > 0) {
                componentLogger('▼ 참조만 변경된 의존성 (내용 동일) ▼');
                componentLogger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');

                referenceChanges.forEach((item) => {
                    componentLogger(`【${item.name}】 (새 객체 참조, 내용 동일)`);
                });
                componentLogger('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
            }
        } else {
            componentLogger('※ 의존성 변화 없음');
        }

        // 렌더링 후 현재 의존성 값을 저장 (다음 렌더링에서 이전 값으로 사용)
        prevDepsCache.set(cacheKey, [...allDeps]);
    }

    return componentLogger;
};
