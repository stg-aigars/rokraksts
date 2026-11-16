import type { Metadata } from 'next'
import { WriteFlow } from '@/components/WriteFlow'

export const metadata: Metadata = { title: 'Burtu rakstīšana · Rokraksts' }

export default function WritePage() {
  return <WriteFlow />
}
