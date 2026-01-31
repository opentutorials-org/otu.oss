'use client';
import React, { useState } from 'react';
import Button from '@mui/material/Button';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import { isDarkModeAtom } from '@/lib/jotai';
import { useAtomValue } from 'jotai';
import Fade from '@mui/material/Fade';
type PositionedMenuProps = {
    onChange: (value: string) => void;
    data: { label: string; value: string }[];
    title: string;
    value: string | null;
};
export function SelectBox({ onChange, data, title, value }: PositionedMenuProps) {
    const [anchorEl, setAnchorEl] = React.useState<null | HTMLElement>(null);
    const open = Boolean(anchorEl);
    const handleClick = (event: React.MouseEvent<HTMLElement>) => {
        setAnchorEl(event.currentTarget);
    };
    const handleClose = () => {
        setAnchorEl(null);
    };

    const displayedTitle = value ? data.find((item) => item.value === value)?.label : title;

    return (
        <div className="opacity-65">
            <Button
                sx={{ color: 'var(--text-color)', padding: 0.3, fontSize: 11, fontWeight: 500 }}
                aria-haspopup="true"
                aria-expanded={open ? 'true' : undefined}
                onClick={handleClick}
            >
                {displayedTitle}{' '}
                <span className="ml-1">
                    <OpenIcon></OpenIcon>
                </span>
            </Button>
            <Menu
                anchorEl={anchorEl}
                open={open}
                onClose={handleClose}
                anchorOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 'top',
                    horizontal: 'left',
                }}
                TransitionComponent={Fade}
            >
                {data.map((item) => (
                    <MenuItem
                        key={item.label + item.value}
                        onClick={() => {
                            onChange(item.value);
                            handleClose();
                        }}
                    >
                        {item.label}
                    </MenuItem>
                ))}
            </Menu>
        </div>
    );
}

function OpenIcon() {
    const darkMode = useAtomValue(isDarkModeAtom);
    return (
        <svg
            className="svg stroke-text-color"
            xmlns="http://www.w3.org/2000/svg"
            width="10"
            height="10"
            viewBox="0 0 6 6"
        >
            <path
                fill="none"
                stroke="currentColor"
                strokeWidth="0.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M1.5 2.5L3 4l1.5-1.5"
            ></path>
        </svg>
    );
}
