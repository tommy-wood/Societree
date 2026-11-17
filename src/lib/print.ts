import * as Print from 'expo-print';

/** Phone app: the system print sheet, which can also save or share a PDF. */
export async function printHtml(html: string): Promise<void> {
  await Print.printAsync({ html });
}
