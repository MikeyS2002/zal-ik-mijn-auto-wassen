import Image from "next/image";

export default function Home() {
    return (
        <main className="h-screen relative ">
            <div className="fixed z-10 top-[120px] max-w-[650px] left-1/2 -translate-x-1/2 text-center">
                <h1 className="h2">Ja, je kan vandaag je auto wassen</h1>
                <h2 className="body mt-4">
                    Je je kan je autw wassen en het vaan een beetje mizeren
                </h2>
            </div>
            <Image
                src="/images/ja/ja-5.jpg"
                alt="img"
                width={3000}
                height={2000}
                priority
                className="object-cover h-full w-full select-none pointer-none"
            />
        </main>
    );
}
