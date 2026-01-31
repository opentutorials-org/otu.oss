import { BlockNoteView, lightDefaultTheme, darkDefaultTheme } from '@blocknote/mantine';

const lightTheme = {
    colors: {
        editor: {
            text: 'var(--text-color)', // 텍스트 색상을 CSS 변수로 변경
            background: 'var(--bg-color)', // 배경색을 CSS 변수로 변경
        },
    },
};

const darkTheme = {
    colors: {
        editor: {
            text: 'var(--text-color)', // 텍스트 색상을 CSS 변수로 변경
            background: 'var(--bg-color)', // 배경색을 CSS 변수로 변경
        },
    },
};

const customTheme = {
    light: lightTheme,
    dark: darkTheme,
};

export { customTheme };
