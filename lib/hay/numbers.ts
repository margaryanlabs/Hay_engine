const units = ["զրո", "մեկ", "երկու", "երեք", "չորս", "հինգ", "վեց", "յոթ", "ութ", "ինը"];
const teens: Record<number, string> = {
  10: "տասը", 11: "տասնմեկ", 12: "տասներկու", 13: "տասներեք", 14: "տասնչորս",
  15: "տասնհինգ", 16: "տասնվեց", 17: "տասնյոթ", 18: "տասնութ", 19: "տասնինը",
};
const tens: Record<number, string> = {
  20: "քսան", 30: "երեսուն", 40: "քառասուն", 50: "հիսուն", 60: "վաթսուն",
  70: "յոթանասուն", 80: "ութսուն", 90: "իննսուն",
};

function underThousand(n: number): string {
  if (n < 10) return units[n];
  if (n < 20) return teens[n];
  if (n < 100) {
    const base = Math.floor(n / 10) * 10;
    const rest = n % 10;
    return rest ? `${tens[base]}${units[rest]}` : tens[base];
  }
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  const head = hundreds === 1 ? "հարյուր" : `${units[hundreds]} հարյուր`;
  return rest ? `${head} ${underThousand(rest)}` : head;
}

export function numberToArmenian(n: number): string {
  if (!Number.isFinite(n)) return String(n);
  n = Math.round(n);
  if (n < 0) return `մինուս ${numberToArmenian(Math.abs(n))}`;
  if (n < 1000) return underThousand(n);
  if (n < 1_000_000) {
    const thousands = Math.floor(n / 1000);
    const rest = n % 1000;
    const head = thousands === 1 ? "հազար" : `${underThousand(thousands)} հազար`;
    return rest ? `${head} ${underThousand(rest)}` : head;
  }
  if (n < 1_000_000_000) {
    const millions = Math.floor(n / 1_000_000);
    const rest = n % 1_000_000;
    const head = millions === 1 ? "մեկ միլիոն" : `${numberToArmenian(millions)} միլիոն`;
    return rest ? `${head} ${numberToArmenian(rest)}` : head;
  }
  return String(n);
}
