export function asyncHandler(fn) {
  return (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);
}

export function httpError(status, message) {
  const err = new Error(message);
  err.status = status;
  return err;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

/** Chuyển chuỗi số kiểu "1,2 Tr", "1.2M", "12.345" ... về số nguyên. */
export function parseCount(text) {
  if (text == null) return null;
  if (typeof text === 'number') return Math.round(text);
  let s = String(text).trim().toLowerCase().replace(/ /g, ' ');
  s = s.replace(/(lượt xem|views?|người đăng ký|subscribers?|followers?|likes?|video[s]?)/g, '').trim();
  const m = s.match(/([\d.,]+)\s*(k|m|b|n|tr|t|nghìn|triệu|tỷ)?/i);
  if (!m) return null;
  let num = m[1];
  const suffix = (m[2] || '').toLowerCase();
  // Nếu có hậu tố (1.2M) thì dấu chấm/phẩy là thập phân; nếu không, coi là phân tách hàng nghìn khi theo nhóm 3 chữ số
  if (suffix) {
    num = parseFloat(num.replace(',', '.'));
  } else if (/^\d{1,3}([.,]\d{3})+$/.test(num)) {
    num = parseInt(num.replace(/[.,]/g, ''), 10);
  } else {
    num = parseFloat(num.replace(',', '.'));
  }
  if (Number.isNaN(num)) return null;
  const mult = { k: 1e3, nghìn: 1e3, n: 1e3, m: 1e6, tr: 1e6, triệu: 1e6, b: 1e9, t: 1e9, tỷ: 1e9 }[suffix] || 1;
  return Math.round(num * mult);
}

/** Tìm đệ quy key trong object JSON lồng nhau, trả về giá trị đầu tiên. */
export function deepFind(obj, key, depth = 0) {
  if (!obj || typeof obj !== 'object' || depth > 30) return undefined;
  if (Object.prototype.hasOwnProperty.call(obj, key)) return obj[key];
  for (const k of Object.keys(obj)) {
    const found = deepFind(obj[k], key, depth + 1);
    if (found !== undefined) return found;
  }
  return undefined;
}
