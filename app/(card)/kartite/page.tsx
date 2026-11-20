import type { Metadata } from 'next'
import { CardEditor } from '@/components/CardEditor'

export const metadata: Metadata = { title: 'Kartīte · Rokraksts' }

export default function CardPage() {
  return <CardEditor />
}
