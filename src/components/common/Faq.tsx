'use client';

import { getUserLocale } from '@/i18n';
import { loadMessages } from '@/messages';
import { useState, useEffect } from 'react';

interface FaqProps {
    isModal?: boolean;
}

export default function Faq({ isModal = false }: FaqProps) {
    const [faqData, setFaqData] = useState<{
        title: string;
        items: { question: string; answer: string }[];
    } | null>(null);

    useEffect(() => {
        async function fetchFaq() {
            const locale = await getUserLocale();
            const data = await loadMessages(locale, 'faq');
            setFaqData(data);
        }
        fetchFaq();
    }, []);
    return <></>; // 아직 FAQ 데이터가 없음
    // if (!faqData) return <div>Loading...</div>;
    // return (
    //     <>
    //         <div className="mx-auto max-w-7xl px-6 py-2 sm:py-2 lg:px-8 lg:py-2">
    //             <div className="mx-auto max-w-4xl divide-y divide-gray-900/10">
    //                 <h2 className="text-xl font-semibold tracking-tight text-gray-900 sm:text-1xl">
    //                     {faqData.title}
    //                 </h2>
    //                 <dl className="mt-10 space-y-2 divide-y divide-gray-900/10">
    //                     {faqData.items.map((item, index) => (
    //                         <Disclosure key={item.question} as="div" className="pt-6">
    //                             <dt>
    //                                 <DisclosureButton className="group flex w-full items-start justify-between text-left text-gray-900">
    //                                     <span className="text-base/7 font-semibold">
    //                                         {item.question}
    //                                     </span>
    //                                     <span className="ml-6 flex h-7 items-center">
    //                                         <PlusIcon
    //                                             aria-hidden="true"
    //                                             className="size-6 group-data-[open]:hidden"
    //                                         />
    //                                         <MinusIcon
    //                                             aria-hidden="true"
    //                                             className="size-6 [.group:not([data-open])_&]:hidden"
    //                                         />
    //                                     </span>
    //                                 </DisclosureButton>
    //                             </dt>
    //                             <DisclosurePanel as="dd" className="mt-2 pr-12">
    //                                 <p className="text-base/7 text-gray-600">{item.answer}</p>
    //                             </DisclosurePanel>
    //                         </Disclosure>
    //                     ))}
    //                 </dl>
    //             </div>
    //         </div>
    //     </>
    // );
}
