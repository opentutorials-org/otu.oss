import { useEffect, useState } from 'react';

export default function Wrapper({ children }: { children: React.ReactNode }) {
    return (
        <div
            id="create_button"
            className={`
        flex mb-5 items-center gap-x-1 
        rounded-[3px] border-[1px] border-color px-4 pr-3 py-[0.5rem]
      dark:border-[#6d6d6d] focus-bg-color min-h-[52px]
      `}
        >
            <div className="flex w-full items-center">{children}</div>
        </div>
    );
}
