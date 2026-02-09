export const splitForTelegram = (text: string, maxLen = 3900): string[] => {
  if (text.length <= maxLen) {
    return [text];
  }

  const chunks: string[] = [];
  let offset = 0;
  while (offset < text.length) {
    chunks.push(text.slice(offset, offset + maxLen));
    offset += maxLen;
  }
  return chunks;
};
