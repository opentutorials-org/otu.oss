'use client';
import ExportButton from '@/components/common/button/ExportButton';
import { useEffect, useState } from 'react';
import s from '../style.module.css';
import { useSetAtom } from 'jotai';
import { useLingui } from '@lingui/react/macro';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function Export() {
    const [toggle, setToggle] = useState(false);
    const { t } = useLingui();
    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t`데이터 내보내기`}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={`${s.root}`}>
                    <div>{t`생성한 모든 데이터를 제공합니다. 서비스 필요에 의해 생성된 일부 데이터는 제공되지 않습니다. 현재 데이터는 JSON 형식으로 제공됩니다. 이미지는 파일로 제공되지 않습니다. 콘텐츠에서 추출하십시오.`}</div>

                    <dl className="mt-6">
                        <dt
                            onClick={() => setToggle(!toggle)}
                            className="cursor-pointer hover:border-b-[1px] border-black inline"
                        >
                            {t`파일 형식에 대해 자세히 알아보기`}{' '}
                            {toggle ? (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-6 h-6 inline"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m4.5 15.75 7.5-7.5 7.5 7.5"
                                    />
                                </svg>
                            ) : (
                                <svg
                                    xmlns="http://www.w3.org/2000/svg"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    strokeWidth={1.5}
                                    stroke="currentColor"
                                    className="w-6 h-6  inline"
                                >
                                    <path
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                        d="m19.5 8.25-7.5 7.5-7.5-7.5"
                                    />
                                </svg>
                            )}
                        </dt>
                        {toggle && (
                            <dd className="mt-2.5">
                                <div className="text-sm">page.json</div>
                                <div className={`${s.wrapper} mt-2`}>
                                    <table className="text-xs border">
                                        <thead>
                                            <tr>
                                                <th>{t`열`}</th>
                                                <th>{t`데이터 유형`}</th>
                                                <th>{t`설명`}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th>{t`ID`}</th>
                                                <td>{t`정수`}</td>
                                                <td>{t`각 페이지의 고유 식별자입니다. 자동으로 생성되며 페이지를 구별하는 데 사용됩니다.`}</td>
                                            </tr>
                                            <tr>
                                                <th>{t`제목`}</th>
                                                <td>{t`텍스트`}</td>
                                                <td>{t`페이지 제목입니다. 페이지의 주제나 내용을 간략하게 표현합니다.`}</td>
                                            </tr>
                                            <tr>
                                                <th>{t`본문`}</th>
                                                <td>{t`텍스트`}</td>
                                                <td>{t`페이지 내용입니다. 텍스트 형식으로 저장되며 페이지에 대한 자세한 정보를 포함합니다.`}</td>
                                            </tr>
                                            <tr>
                                                <th>{t`공개 여부`}</th>
                                                <td>{t`불리언`}</td>
                                                <td>{t`페이지가 공개 여부를 나타냅니다. \`true\`이면 페이지가 공개됩니다.`}</td>
                                            </tr>
                                            <tr>
                                                <th>{t`마지막 조회 시간`}</th>
                                                <td>{t`타임스탬프 (시간대 포함)`}</td>
                                                <td>{t`소유자가 마지막으로 페이지를 본 날짜와 시간입니다. 사용자 활동을 추적합니다.`}</td>
                                            </tr>
                                            <tr>
                                                <th>{t`생성일`}</th>
                                                <td>{t`타임스탬프 (시간대 포함)`}</td>
                                                <td>{t`페이지가 생성된 날짜와 시간입니다. 페이지의 최초 생성 시간을 나타냅니다.`}</td>
                                            </tr>
                                            <tr>
                                                <th>{t`수정일`}</th>
                                                <td>{t`타임스탬프 (시간대 포함)`}</td>
                                                <td>{t`페이지가 마지막으로 수정된 날짜와 시간입니다. 최신 변경 사항을 나타냅니다.`}</td>
                                            </tr>
                                        </tbody>
                                    </table>
                                </div>
                            </dd>
                        )}
                    </dl>

                    <div className={s.apply}>
                        <ExportButton />
                    </div>
                </div>
            </AccordionDetails>
        </Accordion>
    );
}
