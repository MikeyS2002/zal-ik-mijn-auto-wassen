import "./globals.css";

import Navbar from "@/components/Navbar";

export const metadata = {
    title: "Zal ik mijn auto wassen?",
    description: "TODO: description",
};

export default function RootLayout({ children }) {
    return (
        <html lang="en">
            <body className="antialiased">
                <Navbar />
                {children}
            </body>
        </html>
    );
}
