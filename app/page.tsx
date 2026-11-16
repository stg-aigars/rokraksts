import Link from 'next/link'

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-8 px-6 text-center">
      <div className="flex flex-col gap-3">
        <h1 className="text-4xl font-semibold tracking-tight">Rokraksts</h1>
        <p className="text-lg text-ink/70">
          Uzraksti burtus ar pirkstu un nosūti apsveikumu savā rokrakstā.
        </p>
      </div>
      <Link
        href="/raksti"
        className="rounded-full bg-accent px-8 py-4 text-lg font-medium text-white focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-accent"
      >
        Sākt rakstīt
      </Link>
    </main>
  )
}
