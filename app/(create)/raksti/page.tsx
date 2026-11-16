import Link from 'next/link'
import { getCharset, requiredChars } from '@/core/charsets'

// 1. posmā šeit nāks DrawPad; pagaidām lapa tikai parāda, ka rakstzīmju kopa ir pieejama.
export default function WritePage() {
  const chars = requiredChars(getCharset('lv'))

  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col gap-6 px-6 py-10">
      <h1 className="text-2xl font-semibold">Burtu rakstīšana</h1>
      <p className="text-ink/70">
        Zīmēšanas laukums top. Sāksim ar {chars.length} latviešu alfabēta mazajiem burtiem:
      </p>
      <p className="text-xl leading-relaxed tracking-widest" lang="lv">
        {chars.join(' ')}
      </p>
      <Link href="/" className="text-accent underline underline-offset-4">
        Atpakaļ
      </Link>
    </main>
  )
}
