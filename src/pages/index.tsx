import Head from "next/head";
import dynamic from "next/dynamic";

const AppWithoutSSR = dynamic(() => import("@/App"), { ssr: false });

export default function Home() {
    return (
        <>
            <Head>
                <title>PhD Simulator - Fantasy Village</title>
                <meta name="description" content="A fantasy village that grows with your PhD progress" />
                <meta name="viewport" content="width=device-width, initial-scale=1" />
                <link rel="icon" href="/favicon.png" />
            </Head>
            <main style={{ width: '100%', height: '100vh', overflow: 'hidden' }}>
                <AppWithoutSSR />
            </main>
        </>
    );
}
