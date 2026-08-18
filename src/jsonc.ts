export function parseJsonc(text: string): unknown {
  const withoutBom = text.replace(/^\uFEFF/, "");
  const withoutBlock = withoutBom.replace(/\/\*[\s\S]*?\*\//g, "");
  const withoutLine = withoutBlock.replace(/^\s*\/\/.*$/gm, "");
  return JSON.parse(withoutLine);
}

export function stringifyJsonc(value: unknown, header?: string): string {
  const body = `${JSON.stringify(value, null, 2)}\n`;
  return header ? `${header}\n${body}` : body;
}
