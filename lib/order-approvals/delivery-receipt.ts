import { dateLabel, numberLabel, type OrderDetail } from "./types";

const escapeHtml = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (char) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        char
      ]!,
  );

export function canPrintDeliveryReceipt(order: OrderDetail) {
  return Boolean(
    order.approved_at &&
      order.items.length &&
      [
        "READY_TO_SHIP",
        "PREPARING",
        "SHIPPED",
        "DELIVERED",
        "COMPLETED",
      ].includes(order.status),
  );
}

/** The document uses persisted approval quantities, never unsaved revisions. */
export function buildDeliveryReceipt(
  order: OrderDetail,
  warehouseName: string,
) {
  if (!canPrintDeliveryReceipt(order))
    throw new Error(
      "Teslim tutanağı yalnızca onaylanmış siparişler için yazdırılabilir.",
    );
  const requested = order.items.reduce(
    (sum, item) => sum + item.requested_qty,
    0,
  );
  const approved = order.items.reduce(
    (sum, item) => sum + (item.approved_qty ?? 0),
    0,
  );
  const sender =
    order.prepared_by_name ||
    order.events.find((event) => event.action === "APPROVE")?.employee_name ||
    "—";
  const rows = order.items
    .map((item, index) => {
      const qty = item.approved_qty ?? 0;
      const difference = item.requested_qty - qty;
      const status =
        qty === item.requested_qty
          ? "Tam karşılandı"
          : qty === 0
            ? "Karşılanmadı"
            : "Kısmi karşılandı";
      return `<tr><td class="center">${index + 1}</td><td><strong>${escapeHtml(item.product?.name || "Ürün bilgisi bulunamadı")}</strong><small>SKU: ${escapeHtml(item.product?.sku || "—")} · Barkod: ${escapeHtml(item.product?.barcode || "—")}</small></td><td class="center">${item.product?.is_consumable ? "Sarf" : "Ürün"}</td><td class="number">${numberLabel(item.requested_qty)}</td><td class="number">${numberLabel(qty)}</td><td class="number">${numberLabel(difference)}</td><td><b>${status}</b>${item.revision_reason ? `<small>${escapeHtml(item.revision_reason)}</small>` : ""}</td></tr>`;
    })
    .join("");
  return `<!doctype html><html lang="tr"><head><meta charset="utf-8"><title>${escapeHtml(order.order_code)} – Teslim Tutanağı</title><style>
  @page { size: A4 portrait; margin: 12mm; }
  *{box-sizing:border-box}html,body{margin:0;padding:0;color:#171717;background:#fff;font-family:Arial,Helvetica,sans-serif;font-size:10px;line-height:1.45;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .sheet{min-height:272mm;display:flex;flex-direction:column}.content{flex:0 0 auto}.document-header{border-bottom:2px solid #222;padding:0 0 6mm;margin-bottom:5mm}
  h1{font-size:17px;line-height:1.4;letter-spacing:.15px;text-align:center;margin:0 0 3mm;font-weight:700}.document-header p{text-align:center;margin:0;font-size:9px;color:#555}
  .meta{display:grid;grid-template-columns:1fr 1fr;border:1px solid #999;margin:0 0 5mm}.meta div{padding:2.5mm 3mm;border-bottom:1px solid #ccc;min-width:0}.meta div:nth-last-child(-n+2){border-bottom:0}.meta div:nth-child(odd){border-right:1px solid #ccc}.meta span{display:block;font-size:8px;color:#666;text-transform:uppercase;letter-spacing:.35px}.meta strong{display:block;font-size:10px;margin-top:1mm;overflow-wrap:anywhere}
  table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:9px}thead{display:table-header-group}th,td{border:1px solid #888;padding:2.3mm 1.7mm;text-align:left;vertical-align:top;overflow-wrap:anywhere}th{font-size:8px;background:#eee;font-weight:700;vertical-align:middle}tr{break-inside:avoid;page-break-inside:avoid}td strong{font-size:9px;font-weight:600}td small{display:block;font-size:8px;color:#555;margin-top:1mm;white-space:pre-wrap}td b{font-size:8px;font-weight:600}.number{text-align:right;font-variant-numeric:tabular-nums}.center{text-align:center}
  .totals{display:flex;justify-content:flex-end;gap:6mm;padding:3mm 0;border-bottom:1px solid #bbb;font-size:9px;break-inside:avoid}.totals b{margin-left:1.5mm}.note{border:1px solid #aaa;padding:3mm;margin-top:4mm;white-space:pre-wrap;overflow-wrap:anywhere;break-inside:avoid}.note strong{display:block;margin-bottom:1mm}.explanation{font-size:8px;color:#555;margin:4mm 0 0}
  .signatures{margin-top:auto;padding-top:10mm;display:flex;justify-content:space-between;gap:20mm;break-inside:avoid;page-break-inside:avoid}.signature{width:72mm;text-align:center;min-height:36mm;padding-top:3mm}.signature h2{font-size:10px;letter-spacing:.5px;margin:0 0 3mm}.signature strong{display:block;min-height:9mm;font-size:11px;overflow-wrap:anywhere}.signature p{font-size:9px;margin:3mm 0 0}.signature .line{border-top:1px solid #555;margin-top:13mm;padding-top:2mm;font-size:8px;color:#555}.doc-footer{font-size:7px;text-align:center;color:#777;margin-top:5mm}
  @media screen{body{background:#ddd;padding:12mm}.sheet{width:186mm;margin:auto;background:#fff;box-shadow:0 0 0 12mm #fff}}
  </style></head><body><main class="sheet"><div class="content"><header class="document-header"><h1>LEGO ONLİNE MERKEZ DEPO TESLİM TUTANAĞI</h1><p>Mağaza ürün ve sarf siparişi · Talep / onay / revizyon dökümü</p></header>
  <section class="meta"><div><span>Sipariş numarası</span><strong>${escapeHtml(order.order_code)}</strong></div><div><span>Onay tarihi</span><strong>${escapeHtml(dateLabel(order.approved_at))}</strong></div><div><span>Gönderen depo</span><strong>${escapeHtml(warehouseName)}</strong></div><div><span>Teslim edilecek mağaza</span><strong>${escapeHtml(order.branch_name)}</strong></div><div><span>Talep tarihi</span><strong>${escapeHtml(dateLabel(order.created_at))}</strong></div><div><span>Talep eden</span><strong>${escapeHtml(order.requester_name)}</strong></div></section>
  <table aria-label="Talep ve revizyon tablosu"><colgroup><col style="width:5%"><col style="width:34%"><col style="width:7%"><col style="width:9%"><col style="width:9%"><col style="width:9%"><col style="width:27%"></colgroup><thead><tr><th class="center">No</th><th>Ürün / SKU / Barkod</th><th class="center">Tür</th><th class="number">Talep</th><th class="number">Onaylanan</th><th class="number">Eksik</th><th>Revizyon durumu / Gerekçesi</th></tr></thead><tbody>${rows}</tbody></table>
  <div class="totals"><span>Toplam talep:<b>${numberLabel(requested)} adet</b></span><span>Onaylanan:<b>${numberLabel(approved)} adet</b></span><span>Eksik:<b>${numberLabel(requested - approved)} adet</b></span></div>
  ${order.decision_note ? `<div class="note"><strong>Operasyon notu</strong>${escapeHtml(order.decision_note)}</div>` : ""}<p class="explanation">Teslim edilecek miktarlar “Onaylanan” sütununda belirtilmiştir. Eksik karşılanan veya karşılanmayan kalemlerin gerekçeleri tabloda yer alır.</p></div>
  <section class="signatures"><div class="signature"><h2>GÖNDEREN</h2><strong>${escapeHtml(sender)}</strong><p>Merkez depo sorumlusu</p><div class="line">Ad Soyad / İmza</div></div><div class="signature"><h2>TESLİM ALAN MAĞAZA</h2><strong>${escapeHtml(order.branch_name)}</strong><p>Teslim alan kişi: ........................................</p><div class="line">Ad Soyad / İmza</div></div></section><footer class="doc-footer">${escapeHtml(order.order_code)} · LEGO ONLİNE MERKEZ DEPO TESLİM TUTANAĞI</footer></main></body></html>`;
}
