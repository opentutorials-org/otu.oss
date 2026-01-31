import { BlockNoteView, lightDefaultTheme, darkDefaultTheme } from '@blocknote/mantine';

const lightTheme = {
    colors: {
        editor: {
            text: 'var(--text-color)', // 텍스트 색상을 CSS 변수로 변경
            background: 'transparent', // 배경색을 투명으로 유지
        },
        tooltip: {
            // 25.04.18 background는 동작하지만 text는 지정해도 적용되지 않음.
            text: 'var(--text-color)',
            background: 'var(--bg-color)', // 툴팁 배경색 복원
        },

        shadow: 'none',
        border: 'var(--border-color)',
    },
};

const darkTheme = {
    colors: {
        editor: {
            text: 'var(--text-color)', // 텍스트 색상을 CSS 변수로 변경
            background: 'transparent', // 배경색을 투명으로 변경
        },
    },
};

export const customTheme = {
    light: lightTheme,
    dark: darkTheme,
};

export const blockNoteStyles = {
    container: 'bn-container',
    darkContainer: 'bn-dark-container',
    lightContainer: 'bn-light-container',
};
