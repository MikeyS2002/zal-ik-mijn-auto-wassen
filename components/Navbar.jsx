"use client";
import Image from "next/image";
import React, { useState } from "react";
import Link from "next/link";

const Navbar = () => {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const toggleMenu = () => {
        setIsMenuOpen(!isMenuOpen);
    };

    return (
        <nav className="">
            <Link href="/">
                <Image
                    src="/images/auto_wassen_logo.png"
                    width={96}
                    height={52}
                    className="fixed top-4 md:w-[96px] md:h-[52px] w-[76px] h-[40px] left-4  md:top-10 md:left-10 select-none z-50"
                    alt="Zal ik mijn auto wassen logo"
                />
            </Link>
            <p
                className="fixed top-4 md:top-10 z-50 right-4 md:right-10 menu cursor-pointer select-none"
                onClick={toggleMenu}
            >
                {isMenuOpen ? "Close" : "Menu"}
            </p>
            <div
                className={`fixed z-40 top-0 left-0 h-screen w-full flex justify-center items-center nav-bg transition-opacity duration-300 ease-linear ${
                    isMenuOpen
                        ? "opacity-100 pointer-events-auto"
                        : "opacity-0 pointer-events-none"
                }`}
            >
                <ul className="text-center space-y-10">
                    <li className="h1" onClick={toggleMenu}>
                        <Link href="/">Was Check</Link>
                    </li>
                    <li className="h1" onClick={toggleMenu}>
                        <Link href="/tips">Tips</Link>
                    </li>
                </ul>
                <p className="absolute bottom-10 text-center w-full left-1/2 -translate-1/2">
                    © {new Date().getFullYear()}, Ontwikkeld door{" "}
                    <a
                        href="https://www.uavdevelopment.io/nl"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="link"
                    >
                        UAV Development
                    </a>
                </p>
            </div>
        </nav>
    );
};

export default Navbar;
