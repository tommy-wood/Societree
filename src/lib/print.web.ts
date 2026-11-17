/** Open the invoice in a new tab; it has its own "Print / save as PDF" button. */
export async function printHtml(html: string): Promise<void> {
  const w = window.open('', '_blank');
  if (!w) {
    // Pop-up blocked: show it in this tab instead.
    const blob = new Blob([html], { type: 'text/html' });
    window.location.assign(URL.createObjectURL(blob));
    return;
  }
  w.document.open();
  w.document.write(html);
  w.document.close();
}
