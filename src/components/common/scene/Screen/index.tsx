import React, { ReactNode } from 'react';

interface ScreenProps {
    open: boolean;
    onClose?: () => void;
    children: ReactNode;
    className?: string;
    classNameInner?: string;
}

const Screen: React.FC<ScreenProps> = ({ open, className, classNameInner, children }) => {
    return (
        <>
            <div className="flex justify-center w-full overflow-y-visible overflow-x-hidden">
                <div
                    id="screen_root"
                    className={` w-full max-w-[642px] max-sm:px-0 ${classNameInner}`}
                >
                    <div
                        id="editor_root_wapper_spacer"
                        className="sm:px-[15px] py-[14px] sm:p-[30px] border-color text-color border-t-0 sm:border-[1px] sm:rounded-[3px] min-h-[300px] mb-[140px]"
                    >
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
};

export { Screen };

/*
chat.open : false
=> 
*/
