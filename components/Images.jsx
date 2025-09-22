import React from "react";
import Image from "next/image";

const Images = ({ adviceData }) => {
    return (
        <>
            {adviceData.decision === "JA" && (
                <>
                    <Image
                        alt="Je kan vandaag je auto wassen"
                        src={`/images/ja/desktop-ja-${adviceData.randomNumber}.jpg`}
                        width={2500}
                        priority
                        height={1800}
                        className="w-full select-none pointer-events-none hidden sm:block h-full object-cover absolute top-0 left-0"
                    />
                    <Image
                        alt="Je kan vandaag je auto wassen"
                        src={`/images/ja/mobile-ja-${adviceData.randomNumber}.jpg`}
                        width={800}
                        priority
                        height={1200}
                        className="w-full select-none pointer-events-none sm:hidden block h-full object-cover absolute top-0 left-0"
                    />
                </>
            )}

            {adviceData.decision === "NEE" && (
                <>
                    <Image
                        alt="Je kan vandaag niet je auto wassen"
                        src={`/images/nee/desktop-nee-${adviceData.reasonCategory}.jpg`}
                        width={2500}
                        priority
                        height={1800}
                        className="w-full select-none pointer-events-none hidden sm:block h-full object-cover absolute top-0 left-0"
                    />
                    <Image
                        alt="Je kan vandaag niet je auto wassen"
                        src={`/images/nee/mobile-nee-${adviceData.reasonCategory}.jpg`}
                        width={800}
                        priority
                        height={1200}
                        className="w-full select-none pointer-events-none sm:hidden block h-full object-cover absolute top-0 left-0"
                    />
                </>
            )}
        </>
    );
};

export default Images;
