'use client';
import ExportButton from '@/components/common/button/ExportButton';
import { useEffect, useState } from 'react';
import s from '../style.module.css';
import { useSetAtom } from 'jotai';
import { useTranslations } from 'next-intl';
import Accordion from '@mui/material/Accordion';
import AccordionSummary from '@mui/material/AccordionSummary';
import AccordionDetails from '@mui/material/AccordionDetails';
import Typography from '@mui/material/Typography';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';

export default function Export() {
    const [toggle, setToggle] = useState(false);
    const t = useTranslations('setting');
    return (
        <Accordion>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t('export-data')}</Typography>
            </AccordionSummary>
            <AccordionDetails>
                <div className={`${s.root}`}>
                    <div>{t('we-provide-all-the-data')}</div>

                    <dl className="mt-6">
                        <dt
                            onClick={() => setToggle(!toggle)}
                            className="cursor-pointer hover:border-b-[1px] border-black inline"
                        >
                            {t('learn-more-about-file-formats')}{' '}
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
                                                <th>{t('column')}</th>
                                                <th>{t('data-type')}</th>
                                                <th>{t('description')}</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            <tr>
                                                <th>{t('id')}</th>
                                                <td>{t('integer')}</td>
                                                <td>{t('id-description')}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('title')}</th>
                                                <td>{t('text')}</td>
                                                <td>{t('title-description')}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('body')}</th>
                                                <td>{t('text')}</td>
                                                <td>{t('body-description')}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('is_public')}</th>
                                                <td>{t('boolean')}</td>
                                                <td>{t('is_public-description')}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('last_viewed_at')}</th>
                                                <td>{t('timestamp')}</td>
                                                <td>{t('last_viewed_at-description')}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('created_at')}</th>
                                                <td>{t('timestamp')}</td>
                                                <td>{t('created_at-description')}</td>
                                            </tr>
                                            <tr>
                                                <th>{t('updated_at')}</th>
                                                <td>{t('timestamp')}</td>
                                                <td>{t('updated_at-description')}</td>
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
