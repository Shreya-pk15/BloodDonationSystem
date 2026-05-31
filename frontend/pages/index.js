import Head from "next/head";
import Image from "next/image";
import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-white text-zinc-900 min-h-screen flex flex-col font-sans">
      <Head>
        <title>HemoLink | Save Lives, Donate Blood</title>
        <meta
          name="description"
          content="Connecting blood donors with those in need. Simple, fast, and real-time."
        />
      </Head>

      {/* Navbar */}
      <nav className="w-full border-b border-zinc-100 bg-white flex justify-between items-center px-12 py-6">
        <div className="flex items-center gap-2">
          <span className="text-2xl">🩸</span>
          <span className="text-xl font-bold text-red-500">HemoLink</span>
        </div>

        <div className="flex items-center gap-10">
          <Link
            href="/login"
            className="text-zinc-600 font-medium hover:text-red-500 transition"
          >
            Log In
          </Link>

          <Link
            href="/register"
            className="bg-zinc-900 text-white font-semibold px-7 py-3 rounded-full shadow-md hover:bg-zinc-800 transition"
          >
            Sign Up
          </Link>
        </div>
      </nav>

      {/* Hero Section */}
      <main className="flex-grow flex items-center">
        <section className="w-full">
          <div className="max-w-7xl mx-auto px-12 grid lg:grid-cols-2 gap-20 items-center">

            {/* Left Content */}
            <div className="space-y-10">
              <div className="inline-flex items-center gap-2 bg-red-100 text-red-500 px-6 py-2 rounded-full text-sm font-semibold tracking-wide uppercase">
                <span className="w-2 h-2 bg-red-500 rounded-full"></span>
                Real-Time Blood Donation
              </div>

              <h1 className="text-7xl font-extrabold leading-tight tracking-tight">
                Your Blood Can <br />
                <span className="text-red-500 italic font-bold">
                  Save Live.
                </span>
              </h1>

              <p className="text-xl text-zinc-600 leading-relaxed max-w-xl">
                Connect directly with nearby hospitals and emergency cases. Be
                the hero someone is waiting for today.
              </p>
            </div>

            {/* Right Image */}
            <div className="flex justify-center">
              <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden p-10">
                <Image
                  src="/hero.png"
                  alt="Blood Donation"
                  width={500}
                  height={500}
                  priority
                  className="object-contain"
                />
              </div>
            </div>

          </div>
        </section>
      </main>
    </div>
  );
}