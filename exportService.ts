
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrency } from './dataService';

export interface ExportTx {
  date: string; // YYYY-MM-DD
  description: string;
  value: number;
}
export interface ExportGroup {
  natureLabel: string;
  isCredit: boolean;
  subtotal: number;
  txs: ExportTx[];
}
export interface ExportExtract {
  partnerName: string;
  partnerCpf: string;
  groups: ExportGroup[];
  totalEntradas: number;
  totalSaidas: number;
  lucros: number;
  irrfBase: number;
  irrf: number;
}
export interface FechamentoExport {
  companyFantasia: string;
  companyRazao: string;
  periodo: string; // ex.: "Agosto/2026"
  irrfThreshold: number;
  irrfRatePct: number;
  extracts: ExportExtract[];
  totalEntradas: number;
  totalSaidas: number;
  totalIrrf: number;
}

const fmtDate = (s: string) => {
  const [y, m, d] = (s || '').split('-');
  return (y && m && d) ? `${d}/${m}/${y}` : s;
};

const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

// ---------- Excel (.xlsx) ----------
export const exportFechamentoXlsx = (d: FechamentoExport) => {
  const rows: (string | number)[][] = [];
  rows.push(['Fechamento por Empresa']);
  rows.push([d.companyFantasia, d.companyRazao]);
  rows.push(['Competência', d.periodo]);
  rows.push([]);

  d.extracts.forEach(ext => {
    rows.push([`SÓCIO: ${ext.partnerName}`, `CPF ${ext.partnerCpf || '—'}`]);
    rows.push(['Data', 'Histórico', 'Natureza', 'Entrada (R$)', 'Saída (R$)']);
    ext.groups.forEach(g => {
      g.txs.forEach(t => {
        rows.push([
          fmtDate(t.date),
          t.description || 'Sem observações',
          g.natureLabel,
          g.isCredit ? t.value : '',
          g.isCredit ? '' : t.value
        ]);
      });
      rows.push(['', '', `Subtotal ${g.natureLabel}`, g.isCredit ? g.subtotal : '', g.isCredit ? '' : g.subtotal]);
    });
    rows.push(['', '', 'TOTAL ENTRADAS', ext.totalEntradas, '']);
    rows.push(['', '', 'TOTAL SAÍDAS', '', ext.totalSaidas]);
    rows.push(['', '', 'Retirada de Lucros no mês (líquido)', ext.lucros, '']);
    rows.push(['', '', 'Base de Cálculo IRRF (+10%)', ext.irrfBase, '']);
    rows.push(['', '', `IRRF previsto (${d.irrfRatePct}%)`, ext.irrf > 0 ? ext.irrf : 'Isento', '']);
    rows.push([]);
  });

  rows.push(['RESUMO DA EMPRESA']);
  rows.push(['Total Entradas', d.totalEntradas]);
  rows.push(['Total Saídas', d.totalSaidas]);
  rows.push(['IRRF Previsto Total', d.totalIrrf]);

  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = [{ wch: 14 }, { wch: 40 }, { wch: 30 }, { wch: 18 }, { wch: 18 }];
  // Formata todos os valores numéricos com 2 casas (centavos).
  const range = XLSX.utils.decode_range(ws['!ref'] as string);
  for (let R = range.s.r; R <= range.e.r; R++) {
    for (let C = range.s.c; C <= range.e.c; C++) {
      const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
      if (cell && cell.t === 'n') cell.z = '#,##0.00';
    }
  }
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Fechamento');
  XLSX.writeFile(wb, `fechamento-${slug(d.companyFantasia)}-${slug(d.periodo)}.xlsx`);
};

// ---------- PDF ----------
export const exportFechamentoPdf = (d: FechamentoExport) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  let y = 48;

  doc.setFontSize(16); doc.setTextColor('#2B589A'); doc.setFont('helvetica', 'bold');
  doc.text('Fechamento por Empresa', marginX, y);
  y += 20;
  doc.setFontSize(10); doc.setTextColor('#334155'); doc.setFont('helvetica', 'normal');
  doc.text(`${d.companyFantasia} — ${d.companyRazao}`, marginX, y);
  y += 14;
  doc.text(`Competência: ${d.periodo}`, marginX, y);
  y += 10;

  d.extracts.forEach(ext => {
    const body: (string)[][] = [];
    ext.groups.forEach(g => {
      g.txs.forEach(t => {
        body.push([
          fmtDate(t.date),
          t.description || 'Sem observações',
          g.natureLabel,
          g.isCredit ? formatCurrency(t.value) : '',
          g.isCredit ? '' : formatCurrency(t.value)
        ]);
      });
      body.push(['', '', `Subtotal ${g.natureLabel}`, g.isCredit ? formatCurrency(g.subtotal) : '', g.isCredit ? '' : formatCurrency(g.subtotal)]);
    });

    autoTable(doc, {
      startY: y + 16,
      head: [[{ content: `Sócio: ${ext.partnerName}  (CPF ${ext.partnerCpf || '—'})`, colSpan: 5, styles: { halign: 'left', fillColor: [43, 88, 154], textColor: 255 } }],
             ['Data', 'Histórico', 'Natureza', 'Entrada', 'Saída']],
      body,
      foot: [
        [{ content: 'Total Entradas', colSpan: 3, styles: { halign: 'right' } }, formatCurrency(ext.totalEntradas), ''],
        [{ content: 'Total Saídas', colSpan: 3, styles: { halign: 'right' } }, '', formatCurrency(ext.totalSaidas)],
        [{ content: `Retirada de Lucros (líquido): ${formatCurrency(ext.lucros)}   |   Base de Cálculo IRRF (+10%): ${formatCurrency(ext.irrfBase)}   |   IRRF (${d.irrfRatePct}%): ${ext.irrf > 0 ? formatCurrency(ext.irrf) : 'Isento (< ' + formatCurrency(d.irrfThreshold) + ')'}`, colSpan: 5, styles: { halign: 'left', textColor: ext.irrf > 0 ? [220, 38, 38] : [100, 116, 139], fontStyle: 'bold' } }]
      ],
      styles: { fontSize: 8, cellPadding: 4 },
      headStyles: { fillColor: [241, 245, 249], textColor: [51, 65, 85] },
      footStyles: { fillColor: [248, 250, 252], textColor: [51, 65, 85] },
      columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' } },
      margin: { left: marginX, right: marginX }
    });
    // @ts-ignore autotable anexa lastAutoTable
    y = (doc as any).lastAutoTable.finalY + 8;
  });

  autoTable(doc, {
    startY: y + 12,
    head: [['Resumo da Empresa', '']],
    body: [
      ['Total Entradas', formatCurrency(d.totalEntradas)],
      ['Total Saídas', formatCurrency(d.totalSaidas)],
      ['IRRF Previsto Total', formatCurrency(d.totalIrrf)]
    ],
    styles: { fontSize: 9, cellPadding: 5 },
    headStyles: { fillColor: [43, 88, 154], textColor: 255 },
    columnStyles: { 1: { halign: 'right' } },
    margin: { left: marginX, right: marginX }
  });

  doc.save(`fechamento-${slug(d.companyFantasia)}-${slug(d.periodo)}.pdf`);
};
