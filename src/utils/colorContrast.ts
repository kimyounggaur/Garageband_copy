function rgb(hex: string): [number, number, number] {
  const clean = hex.replace(/^#/, "");
  const expanded = clean.length === 3 ? [...clean].map((digit) => digit + digit).join("") : clean;
  if (!/^[0-9a-f]{6}$/i.test(expanded)) throw new Error(`올바르지 않은 색상: ${hex}`);
  return [0, 2, 4].map((index) => parseInt(expanded.slice(index, index + 2), 16)) as [number, number, number];
}

export function relativeLuminance(hex: string) {
  const channels = rgb(hex).map((value) => {
    const normalized = value / 255;
    return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
  });
  return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
}

export function contrastRatio(first: string, second: string) {
  const left = relativeLuminance(first);
  const right = relativeLuminance(second);
  return (Math.max(left, right) + 0.05) / (Math.min(left, right) + 0.05);
}

export function bestTextColor(background: string, dark = "#10141c", light = "#f8fafc") {
  return contrastRatio(background, dark) >= contrastRatio(background, light) ? dark : light;
}
