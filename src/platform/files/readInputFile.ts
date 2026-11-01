import { checkFileBytes, checkTextBytes } from '../../domain/input/inputBudgets'

export type SizedTextFile = Pick<File, 'size' | 'text'>

export async function readJsonText(file: SizedTextFile): Promise<string> {
  checkFileBytes(file.size, 'json')
  const text = await file.text()
  checkTextBytes(text, 'json')
  return text
}
