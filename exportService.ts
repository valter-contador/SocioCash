
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, AlignmentType, Table, TableRow, TableCell, WidthType, BorderStyle } from 'docx';
import { formatCurrency, formatMutuoNumero, MutuoScheduleRow } from './dataService';

const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
};

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

export const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-|-$/g, '').toLowerCase();

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
// Cores espelhando a paleta usada na tela de Fechamento (Tailwind emerald/rose/slate).
const PDF_COLORS = {
  emeraldBg: [236, 253, 245] as [number, number, number],
  emeraldText: [5, 150, 105] as [number, number, number],
  roseBg: [255, 241, 242] as [number, number, number],
  roseText: [225, 29, 72] as [number, number, number],
  slateBg: [248, 250, 252] as [number, number, number],
  slateBorder: [226, 232, 240] as [number, number, number],
  slateText: [100, 116, 139] as [number, number, number],
  ink: [30, 41, 59] as [number, number, number],
  brand: [43, 88, 154] as [number, number, number],
};

export const buildFechamentoDoc = (d: FechamentoExport): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * marginX;
  let y = 48;
  const ensure = (space: number) => { if (y + space > pageH - 36) { doc.addPage(); y = 40; } };

  // Caixa colorida com título pequeno + valor em destaque (usada nos resumos entradas/saídas/IRRF).
  const drawStatBox = (x: number, w: number, h: number, label: string, value: string, bg: [number, number, number], fg: [number, number, number]) => {
    doc.setFillColor(...bg);
    doc.roundedRect(x, y, w, h, 8, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...fg);
    doc.text(label.toUpperCase(), x + 10, y + 14);
    doc.setFontSize(11);
    doc.text(value, x + 10, y + h - 12);
    doc.setTextColor(...(PDF_COLORS.ink));
  };

  const drawBadge = (text: string, rightX: number, cy: number, bg: [number, number, number], fg: [number, number, number]) => {
    doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5);
    const w = doc.getTextWidth(text) + 16;
    doc.setFillColor(...bg);
    doc.roundedRect(rightX - w, cy - 9, w, 16, 8, 8, 'F');
    doc.setTextColor(...fg);
    doc.text(text, rightX - w / 2, cy + 1.5, { align: 'center' });
    doc.setTextColor(...(PDF_COLORS.ink));
  };

  doc.setFontSize(16); doc.setTextColor(...(PDF_COLORS.brand)); doc.setFont('helvetica', 'bold');
  doc.text('Fechamento por Empresa', marginX, y);
  y += 20;
  doc.setFontSize(10); doc.setTextColor(...(PDF_COLORS.slateText)); doc.setFont('helvetica', 'normal');
  doc.text(`${d.companyFantasia} — ${d.companyRazao}`, marginX, y);
  y += 14;
  doc.text(`Competência: ${d.periodo}`, marginX, y);
  y += 22;

  d.extracts.forEach(ext => {
    ensure(56);
    // Cabeçalho do sócio (nome + CPF + badge de IRRF), espelha o card da tela.
    doc.setFillColor(...(PDF_COLORS.slateBg));
    doc.roundedRect(marginX, y, maxW, 40, 8, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(11); doc.setTextColor(...(PDF_COLORS.ink));
    doc.text(ext.partnerName, marginX + 14, y + 17);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor(...(PDF_COLORS.slateText));
    doc.text(`CPF ${ext.partnerCpf || '—'}`, marginX + 14, y + 30);
    if (ext.irrf > 0) drawBadge(`IRRF ${formatCurrency(ext.irrf)}`, marginX + maxW - 14, y + 20, PDF_COLORS.roseBg, PDF_COLORS.roseText);
    else drawBadge('SEM IRRF', marginX + maxW - 14, y + 20, PDF_COLORS.emeraldBg, PDF_COLORS.emeraldText);
    y += 50;

    // Lançamentos agrupados por natureza — barra com subtotal colorido + lista enxuta.
    ext.groups.forEach(g => {
      ensure(28);
      const fg: [number, number, number] = g.isCredit ? PDF_COLORS.emeraldText : PDF_COLORS.roseText;
      doc.setFillColor(...(PDF_COLORS.slateBg));
      doc.rect(marginX, y, maxW, 18, 'F');
      doc.setFont('helvetica', 'bold'); doc.setFontSize(7.5); doc.setTextColor(...(PDF_COLORS.ink));
      doc.text(g.natureLabel.toUpperCase(), marginX + 8, y + 12);
      doc.setTextColor(...fg);
      doc.text(`${g.isCredit ? '+' : '-'} ${formatCurrency(g.subtotal)}`, marginX + maxW - 8, y + 12, { align: 'right' });
      doc.setTextColor(...(PDF_COLORS.ink));
      y += 18;

      autoTable(doc, {
        startY: y,
        body: g.txs.map(t => [fmtDate(t.date), t.description || 'Sem observações', `${g.isCredit ? '+' : '-'} ${formatCurrency(t.value)}`]),
        theme: 'plain',
        styles: { fontSize: 8, cellPadding: { top: 3, bottom: 3, left: 8, right: 8 }, textColor: [71, 85, 105] },
        columnStyles: {
          0: { cellWidth: 70, fontStyle: 'bold', textColor: [100, 116, 139] },
          2: { cellWidth: 90, halign: 'right', fontStyle: 'bold', textColor: fg }
        },
        didParseCell: data => { if (data.column.index === 1) data.cell.styles.fontStyle = 'italic'; },
        margin: { left: marginX, right: marginX }
      });
      // @ts-ignore autotable anexa lastAutoTable
      y = (doc as any).lastAutoTable.finalY + 6;
    });

    // Resumo do sócio: 3 caixas (Entradas / Saídas / Revisão IRRF), igual à tela.
    const boxH = 62, gap = 10, boxW = (maxW - gap * 2) / 3;
    ensure(boxH + 16);
    drawStatBox(marginX, boxW, boxH, 'Total Entradas', `+ ${formatCurrency(ext.totalEntradas)}`, PDF_COLORS.emeraldBg, PDF_COLORS.emeraldText);
    drawStatBox(marginX + boxW + gap, boxW, boxH, 'Total Saídas', `- ${formatCurrency(ext.totalSaidas)}`, PDF_COLORS.roseBg, PDF_COLORS.roseText);

    const irrfX = marginX + 2 * (boxW + gap);
    const irrfBg: [number, number, number] = ext.irrf > 0 ? PDF_COLORS.roseBg : PDF_COLORS.slateBg;
    doc.setFillColor(...irrfBg);
    doc.roundedRect(irrfX, y, boxW, boxH, 8, 8, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(6.5); doc.setTextColor(...(PDF_COLORS.brand));
    doc.text('REVISÃO IRRF — LUCROS', irrfX + 10, y + 12);
    doc.setFontSize(7); doc.setTextColor(...(PDF_COLORS.slateText)); doc.setFont('helvetica', 'normal');
    doc.text('Lucros (líquido)', irrfX + 10, y + 24);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...(PDF_COLORS.ink));
    doc.text(formatCurrency(ext.lucros), irrfX + boxW - 10, y + 24, { align: 'right' });
    doc.setFont('helvetica', 'normal'); doc.setTextColor(...(PDF_COLORS.slateText));
    doc.text('Base Cálc. IRRF (+10%)', irrfX + 10, y + 35);
    doc.setFont('helvetica', 'bold'); doc.setTextColor(...(PDF_COLORS.ink));
    doc.text(formatCurrency(ext.irrfBase), irrfX + boxW - 10, y + 35, { align: 'right' });
    if (ext.irrf > 0) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor(...(PDF_COLORS.roseText));
      doc.text(`IRRF (${d.irrfRatePct}%)`, irrfX + 10, y + 50);
      doc.text(formatCurrency(ext.irrf), irrfX + boxW - 10, y + 50, { align: 'right' });
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(6.5); doc.setTextColor(...(PDF_COLORS.slateText));
      doc.text(`Isento (< ${formatCurrency(d.irrfThreshold)})`, irrfX + 10, y + 50);
    }
    doc.setTextColor(...(PDF_COLORS.ink));
    y += boxH + 22;
  });

  // Resumo da empresa (igual ao card do topo da tela).
  ensure(70);
  const sBoxH = 54, sGap = 10, sBoxW = (maxW - sGap * 2) / 3;
  drawStatBox(marginX, sBoxW, sBoxH, 'Entradas', formatCurrency(d.totalEntradas), PDF_COLORS.emeraldBg, PDF_COLORS.emeraldText);
  drawStatBox(marginX + sBoxW + sGap, sBoxW, sBoxH, 'Saídas', formatCurrency(d.totalSaidas), PDF_COLORS.roseBg, PDF_COLORS.roseText);
  drawStatBox(marginX + 2 * (sBoxW + sGap), sBoxW, sBoxH, 'IRRF Previsto',
    formatCurrency(d.totalIrrf), d.totalIrrf > 0 ? PDF_COLORS.roseBg : PDF_COLORS.slateBg, d.totalIrrf > 0 ? PDF_COLORS.roseText : PDF_COLORS.slateText);

  return doc;
};

export const exportFechamentoPdf = (d: FechamentoExport) => {
  const doc = buildFechamentoDoc(d);
  doc.save(`fechamento-${slug(d.companyFantasia)}-${slug(d.periodo)}.pdf`);
};

// ---------- Demonstrativo de Capital (Relatórios) ----------
export interface RelatorioExportTx {
  date: string; // YYYY-MM-DD
  originario: string;
  description: string;
  value: number;
  isCredit: boolean;
}
export interface RelatorioExport {
  companyFantasia: string;
  companyRazao: string;
  periodo: string; // ex.: "Agosto 2026"
  initialBalance: number;
  totalCredits: number;
  totalDebits: number;
  finalBalance: number;
  transactions: RelatorioExportTx[];
}

export const exportRelatorioPdf = (d: RelatorioExport) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 46;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor('#2B589A');
  doc.text('Demonstrativo de Capital', marginX, y);
  y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#334155');
  doc.text(`${d.companyFantasia} — ${d.companyRazao}`, marginX, y);
  y += 14;
  doc.text(`Competência: ${d.periodo}`, marginX, y);
  y += 22;

  // Caixa de saldo em destaque.
  const boxW = 210, boxH = 46;
  doc.setDrawColor('#DBE4F1'); doc.setFillColor('#F5F8FC');
  doc.roundedRect(pageW - marginX - boxW, y - 30, boxW, boxH, 6, 6, 'FD');
  doc.setFontSize(8); doc.setTextColor('#64748B');
  doc.text('SALDO EM FECHAMENTO', pageW - marginX - boxW + 12, y - 14);
  doc.setFont('helvetica', 'bold'); doc.setFontSize(15);
  doc.setTextColor(d.finalBalance >= 0 ? '#2B589A' : '#DC2626');
  doc.text(formatCurrency(d.finalBalance), pageW - marginX - boxW + 12, y + 4);
  doc.setTextColor('#111111');
  y += 30;

  autoTable(doc, {
    startY: y,
    head: [['Transporte Mês Anterior', 'Fluxo de Entrada (+)', 'Fluxo de Saída (−)']],
    body: [[formatCurrency(d.initialBalance), `+ ${formatCurrency(d.totalCredits)}`, `- ${formatCurrency(d.totalDebits)}`]],
    styles: { fontSize: 9, cellPadding: 6, halign: 'center' },
    headStyles: { fillColor: [237, 243, 251], textColor: [51, 65, 85], fontStyle: 'bold' },
    bodyStyles: { fontStyle: 'bold' },
    margin: { left: marginX, right: marginX }
  });
  // @ts-ignore autotable anexa lastAutoTable
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor('#334155');
  doc.text('Cronologia de Lançamentos', marginX, y);
  y += 6;

  const body = d.transactions.map(t => [
    fmtDate(t.date),
    t.originario,
    t.description || 'Sem observações',
    t.isCredit ? formatCurrency(t.value) : '',
    t.isCredit ? '' : formatCurrency(t.value)
  ]);

  autoTable(doc, {
    startY: y + 8,
    head: [['Data', 'Originário', 'Histórico', 'Entrada', 'Saída']],
    body: body.length ? body : [[{ content: 'Sem lançamentos no período', colSpan: 5, styles: { halign: 'center', textColor: [148, 163, 184] } } as any, '', '', '', '']],
    styles: { fontSize: 8.5, cellPadding: 5 },
    headStyles: { fillColor: [43, 88, 154], textColor: 255 },
    columnStyles: { 3: { halign: 'right', textColor: [5, 150, 105] }, 4: { halign: 'right', textColor: [225, 29, 72] } },
    margin: { left: marginX, right: marginX }
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 24;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#94A3B8');
  doc.text(`Gerado por Sistema JC Buarque em ${new Date().toLocaleString('pt-BR')}`, marginX, y);
  doc.setTextColor('#2B589A'); doc.setFont('helvetica', 'bold');
  doc.text('Autenticidade Garantida', pageW - marginX, y, { align: 'right' });

  doc.save(`demonstrativo-${slug(d.companyFantasia)}-${slug(d.periodo)}.pdf`);
};

// ---------- Contrato de Mútuo (PDF) ----------
export interface MutuoContrato {
  numero: number;
  direction: 'EMPRESA_PARA_SOCIO' | 'SOCIO_PARA_EMPRESA';
  socioTipo: 'PF' | 'PJ';
  empresaRazao: string;
  empresaFantasia: string;
  empresaCnpj: string;
  empresaEndereco?: string;
  foroComarca?: string;
  socioNome: string;
  socioCpf: string;
  socioEndereco?: string;
  valor: number;
  releaseDate: string;
  dueDate: string;
  parcelas: number;
  annualInterestPct: number;
  dias: number;
  juros: number;
  iof: number;
  iofAplicavel: boolean;
  irrfJuros: number;
  irrfAliquota: number; // fração
  totalComJuros: number;
  observacao?: string;
}

const dataExtenso = (d = new Date()) => {
  const meses = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];
  return `${d.getDate()} de ${meses[d.getMonth()]} de ${d.getFullYear()}`;
};

type ContratoBlock =
  | { kind: 'title' | 'subtitle' | 'note' | 'para' | 'heading'; text: string }
  | { kind: 'para-prefix'; prefix: string; rest: string } // parágrafo com o início ("MUTUANTE:"/"MUTUÁRIO:") em negrito
  | { kind: 'signrow'; left: string; right: string }
  | { kind: 'spacer'; lines?: number }; // linhas em branco (padrão 2)

const numBR = (n: number): string => Math.round(n).toLocaleString('pt-BR');

// Monta o conteúdo do contrato uma única vez (usado tanto no PDF quanto no DOCX).
// Redação alinhada ao modelo revisado pelo jurídico (contrato de referência).
const buildContratoBlocks = (m: MutuoContrato): { blocks: ContratoBlock[]; fileBase: string } => {
  const oneroso = m.annualInterestPct > 0;
  const empresaEhMutuante = m.direction === 'EMPRESA_PARA_SOCIO';
  const empresaQualif = `${m.empresaRazao}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${m.empresaCnpj || '____________________'}, com sede em ${m.empresaEndereco || '____________________'}`;
  const docLabelSocio = m.socioTipo === 'PF' ? 'CPF' : 'CNPJ';
  const socioQualif = `${m.socioNome}, ${m.socioTipo === 'PF' ? 'pessoa física' : 'pessoa jurídica'}, inscrito(a) no ${docLabelSocio} sob o nº ${m.socioCpf || '____________________'}, residente/domiciliado(a) em ${m.socioEndereco || '____________________'}`;
  const mutuante = empresaEhMutuante ? empresaQualif : socioQualif;
  const mutuario = empresaEhMutuante ? socioQualif : empresaQualif;

  const b: ContratoBlock[] = [];
  // Título sem a referência "GRATUITO" (para não estimular a prática).
  b.push({ kind: 'title', text: `CONTRATO DE MÚTUO${oneroso ? ' FENERATÍCIO' : ''}` });
  b.push({ kind: 'subtitle', text: `Nº ${formatMutuoNumero(m.numero, m.releaseDate)}` });
  b.push({ kind: 'para', text: 'Pelo presente instrumento particular, as partes a seguir qualificadas:' });
  b.push({ kind: 'para-prefix', prefix: 'MUTUANTE:', rest: ` ${mutuante}; e` });
  b.push({ kind: 'para-prefix', prefix: 'MUTUÁRIO:', rest: ` ${mutuario}.` });
  b.push({ kind: 'para', text: 'têm entre si, justo e contratado, o presente Contrato de Mútuo, que se regerá pelas cláusulas e condições seguintes, nos termos dos artigos 586 e seguintes do Código Civil.' });
  b.push({ kind: 'heading', text: 'CLÁUSULA 1ª — DO OBJETO' });
  b.push({ kind: 'para', text: `O MUTUANTE entrega ao MUTUÁRIO, a título de mútuo, a quantia de ${formatCurrency(m.valor)}, disponibilizada por transferência/crédito na conta do MUTUÁRIO em ${fmtDate(m.releaseDate)}.` });
  b.push({ kind: 'heading', text: 'CLÁUSULA 2ª — DO PRAZO E DA RESTITUIÇÃO' });
  b.push({ kind: 'para', text: `O valor será restituído no prazo de ${numBR(m.dias)} dia(s), com vencimento final em ${fmtDate(m.dueDate)}, ${m.parcelas > 1 ? `em (${m.parcelas}) parcelas mensais e sucessivas` : 'em parcela única no vencimento'}. Não havendo prazo estipulado, presume-se o vencimento na forma do art. 592 do Código Civil.` });
  b.push({ kind: 'heading', text: 'CLÁUSULA 3ª — DOS JUROS' });
  if (oneroso) {
    b.push({ kind: 'para', text: `Sobre o valor mutuado incidirão juros remuneratórios à taxa de ${m.annualInterestPct}% ao ano (taxa SELIC), calculados de forma simples e pro rata die pelo período de ${numBR(m.dias)} dia(s), correspondendo a ${formatCurrency(m.juros)}, totalizando ${formatCurrency(m.totalComJuros)} a serem restituídos.` });
  } else {
    b.push({ kind: 'para', text: `Restitui-se o valor principal de ${formatCurrency(m.valor)} na forma ajustada entre as partes.` });
  }
  b.push({ kind: 'heading', text: 'CLÁUSULA 4ª — DOS TRIBUTOS' });
  const tributos: string[] = [];
  // Código do DARF do IOF-crédito segue a natureza jurídica do MUTUÁRIO (tomador), não do
  // mutuante: PF = 7893, PJ = 1150. O IOF só se aplica quando a empresa é a mutuante (iofAplicavel),
  // caso em que o mutuário é sempre o sócio — daí o código seguir m.socioTipo.
  if (m.iofAplicavel) {
    const darfCode = m.socioTipo === 'PF' ? '7893' : '1150';
    tributos.push(`Por se tratar de mútuo concedido por pessoa jurídica, incide o IOF no valor total de ${formatCurrency(m.iof)}, de responsabilidade do MUTUANTE, a ser recolhido via DARF, código ${darfCode}, até o 3º dia útil subsequente ao decêndio de ocorrência do fato gerador, nos termos do art. 70, II, "c", da Lei nº 11.196/2005.`);
  }
  else tributos.push(`Não há incidência de IOF corporativo, por se tratar de mútuo concedido por pessoa física à pessoa jurídica.`);
  if (oneroso) tributos.push(`Sobre os juros incide o Imposto de Renda Retido na Fonte à alíquota de ${(m.irrfAliquota * 100).toFixed(1)}% (${formatCurrency(m.irrfJuros)}), conforme o prazo da operação, retido por ocasião do pagamento/crédito dos rendimentos.`);
  b.push({ kind: 'para', text: tributos.join(' ') });
  b.push({ kind: 'heading', text: 'CLÁUSULA 5ª — DO VENCIMENTO ANTECIPADO' });
  b.push({ kind: 'para', text: 'Ocorrerá o vencimento antecipado da dívida, independentemente de aviso ou notificação, na hipótese de inadimplemento de qualquer obrigação aqui prevista, observada a legislação aplicável.' });
  b.push({ kind: 'heading', text: 'CLÁUSULA 6ª — DO FORO' });
  b.push({ kind: 'para', text: `Fica eleito o foro da comarca de ${m.foroComarca || '____________________'} para dirimir quaisquer controvérsias oriundas do presente contrato.` });
  if (m.observacao) { b.push({ kind: 'heading', text: 'OBSERVAÇÕES' }); b.push({ kind: 'para', text: m.observacao }); }
  b.push({ kind: 'spacer' });
  b.push({ kind: 'para', text: 'E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.' });
  b.push({ kind: 'spacer' });
  b.push({ kind: 'para', text: `${m.foroComarca || '____________________'}, ${dataExtenso()}.` });
  b.push({ kind: 'spacer' });
  b.push({ kind: 'signrow', left: 'MUTUANTE', right: 'MUTUÁRIO' });

  const fileBase = empresaEhMutuante ? `${slug(m.empresaFantasia)}-para-${slug(m.socioNome)}` : `${slug(m.socioNome)}-para-${slug(m.empresaFantasia)}`;
  return { blocks: b, fileBase };
};

export const buildMutuoContratoDoc = (m: MutuoContrato): { doc: jsPDF; fileBase: string } => {
  const { blocks, fileBase } = buildContratoBlocks(m);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 44;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * margin;
  let y = margin;
  const ensure = (space: number) => { if (y + space > pageH - margin) { doc.addPage(); y = margin; } };

  // Quebra manual de linha respeitando um recuo (largura do prefixo em negrito) só na 1ª linha.
  const wrapWithPrefix = (prefixWidth: number, rest: string): string[] => {
    const words = rest.trim().split(/\s+/);
    const lines: string[] = [];
    let current = '';
    let firstLine = true;
    for (const word of words) {
      const test = current ? `${current} ${word}` : word;
      const avail = (firstLine ? maxW - prefixWidth : maxW);
      if (current && doc.getTextWidth(test) > avail) {
        lines.push(current);
        current = word;
        firstLine = false;
      } else {
        current = test;
      }
    }
    if (current) lines.push(current);
    return lines;
  };

  blocks.forEach(bl => {
    if (bl.kind === 'title') {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#2B589A');
      doc.text(bl.text, pageW / 2, y, { align: 'center' }); y += 22; doc.setTextColor('#111111');
    } else if (bl.kind === 'subtitle') {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.setTextColor('#64748B');
      doc.text(bl.text, pageW / 2, y, { align: 'center' }); y += 18; doc.setTextColor('#111111');
    } else if (bl.kind === 'note') {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor('#9a3412');
      const lines = doc.splitTextToSize(bl.text, maxW); ensure(lines.length * 11 + 10);
      doc.text(lines, margin, y); y += lines.length * 11 + 10; doc.setTextColor('#111111');
    } else if (bl.kind === 'heading') {
      ensure(20); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(bl.text, margin, y); y += 13;
    } else if (bl.kind === 'signrow') {
      // Duas colunas lado a lado (MUTUANTE | MUTUÁRIO), sem testemunhas —
      // igual ao modelo revisado pelo jurídico.
      ensure(40);
      const gap = 30;
      const colW = (maxW - gap) / 2;
      const leftX = margin, rightX = margin + colW + gap;
      doc.setDrawColor('#111111');
      doc.line(leftX, y, leftX + colW, y);
      doc.line(rightX, y, rightX + colW, y);
      y += 13;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9);
      doc.text(bl.left, leftX + colW / 2, y, { align: 'center' });
      doc.text(bl.right, rightX + colW / 2, y, { align: 'center' });
      y += 18;
    } else if (bl.kind === 'spacer') {
      // Linhas em branco (padrão 2) — espaço para reserva/leitura antes de assinar.
      y += 13 * (bl.lines ?? 2);
    } else if (bl.kind === 'para-prefix') {
      // Prefixo ("MUTUANTE:"/"MUTUÁRIO:") em negrito, resto do parágrafo normal.
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10);
      const prefixW = doc.getTextWidth(`${bl.prefix} `);
      doc.setFont('helvetica', 'normal');
      const wrapped = wrapWithPrefix(prefixW, bl.rest);
      ensure(wrapped.length * 13 + 7);
      doc.setFont('helvetica', 'bold');
      doc.text(bl.prefix, margin, y);
      doc.setFont('helvetica', 'normal');
      if (wrapped.length > 0) doc.text(wrapped[0], margin + prefixW, y);
      if (wrapped.length > 1) {
        doc.text(wrapped.slice(1), margin, y + 13, { maxWidth: maxW, align: 'justify' });
      }
      y += wrapped.length * 13 + 7;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const lines = doc.splitTextToSize(bl.text, maxW); ensure(lines.length * 13 + 7);
      doc.text(lines, margin, y, { maxWidth: maxW, align: 'justify' }); y += lines.length * 13 + 7;
    }
  });

  return { doc, fileBase };
};

export const exportMutuoContratoPdf = (m: MutuoContrato) => {
  const { doc, fileBase } = buildMutuoContratoDoc(m);
  doc.save(`contrato-mutuo-${fileBase}.pdf`);
};

const NO_BORDER = { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' } as const;
const SIGN_BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' } as const;

// Tabela de assinaturas em 2 colunas (MUTUANTE | espaço | MUTUÁRIO), sem
// testemunhas — reproduz as larguras e a linha superior do modelo jurídico.
const buildSignatureTable = (left: string, right: string): Table =>
  new Table({
    width: { size: 9749, type: WidthType.DXA },
    columnWidths: [4531, 426, 4792],
    borders: { top: NO_BORDER, bottom: NO_BORDER, left: NO_BORDER, right: NO_BORDER, insideHorizontal: NO_BORDER, insideVertical: NO_BORDER },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 4531, type: WidthType.DXA },
            borders: { top: SIGN_BORDER },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: left, size: 20 })] })],
          }),
          new TableCell({
            width: { size: 426, type: WidthType.DXA },
            children: [new Paragraph({ children: [] })],
          }),
          new TableCell({
            width: { size: 4792, type: WidthType.DXA },
            borders: { top: SIGN_BORDER },
            children: [new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: right, size: 20 })] })],
          }),
        ],
      }),
    ],
  });

// ---------- Mútuo: resumo compartilhado pelo Espelho e pelo Demonstrativo ----------
export interface MutuoResumo {
  numero: number;
  direction: 'EMPRESA_PARA_SOCIO' | 'SOCIO_PARA_EMPRESA';
  socioTipo: 'PF' | 'PJ';
  empresaFantasia: string;
  socioNome: string;
  valor: number;
  releaseDate: string;
  firstInstallmentDate?: string;
  dueDate: string;
  parcelas: number;
  annualInterestPct: number;
  dias: number;
  juros: number;
  iofFixo: number;
  iofDiario: number;
  iof: number;
  iofAplicavel: boolean;
  irrfAliquota: number; // fração
  irrfJuros: number;
  totalComJuros: number;
  installmentValue: number;
  installmentAmortizacao: number;
  installmentJuros: number;
  installmentIrrf: number;
  alertaSemJuros: boolean;
  observacao?: string;
  fileBase: string;
}

const espelhoStatBox = (doc: jsPDF, x: number, y: number, w: number, h: number, label: string, value: string, tone: 'blue' | 'rose' | 'slate' = 'slate') => {
  const bg: [number, number, number] = tone === 'blue' ? [237, 243, 251] : tone === 'rose' ? [255, 241, 242] : [248, 250, 252];
  const fg: [number, number, number] = tone === 'blue' ? [43, 88, 154] : tone === 'rose' ? [225, 29, 72] : [51, 65, 85];
  doc.setFillColor(...bg);
  doc.roundedRect(x, y, w, h, 7, 7, 'F');
  doc.setFont('helvetica', 'bold'); doc.setFontSize(6); doc.setTextColor(150, 150, 150);
  doc.text(label.toUpperCase(), x + 9, y + 13, { maxWidth: w - 18 });
  doc.setFontSize(10.5); doc.setTextColor(...fg);
  doc.text(value, x + 9, y + h - 10, { maxWidth: w - 18 });
  doc.setTextColor(30, 41, 59);
};

const espelhoStatRow = (doc: jsPDF, marginX: number, maxW: number, y: number, items: { label: string; value: string; tone?: 'blue' | 'rose' | 'slate' }[]): number => {
  const cols = items.length;
  const gap = 8, boxH = 40;
  const boxW = (maxW - gap * (cols - 1)) / cols;
  items.forEach((it, i) => espelhoStatBox(doc, marginX + i * (boxW + gap), y, boxW, boxH, it.label, it.value, it.tone));
  return y + boxH + 14;
};

// ---------- Espelho do Mútuo (impressão da tela, PDF) ----------
export const buildMutuoEspelhoDoc = (m: MutuoResumo): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageW = doc.internal.pageSize.getWidth();
  const maxW = pageW - 2 * marginX;
  let y = 46;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor('#2B589A');
  doc.text('Espelho do Mútuo', marginX, y);
  y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#334155');
  const origem = m.direction === 'EMPRESA_PARA_SOCIO' ? m.empresaFantasia : m.socioNome;
  const destino = m.direction === 'EMPRESA_PARA_SOCIO' ? m.socioNome : m.empresaFantasia;
  doc.text(`${origem}  →  ${destino}`, marginX, y);
  y += 14;
  doc.setTextColor('#94A3B8');
  doc.text(`Contrato Nº ${formatMutuoNumero(m.numero, m.releaseDate)}`, marginX, y);
  doc.setTextColor('#334155');
  y += 22;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor('#94A3B8');
  doc.text('DADOS DO CONTRATO', marginX, y);
  y += 8;
  y = espelhoStatRow(doc, marginX, maxW, y, [
    { label: 'Valor do Mútuo', value: formatCurrency(m.valor) },
    { label: 'Data Pago', value: fmtDate(m.releaseDate) },
    { label: 'Nº de Parcelas', value: String(m.parcelas) },
    { label: 'Data 1ª Parcela', value: m.firstInstallmentDate ? fmtDate(m.firstInstallmentDate) : '—' },
    { label: 'Data Última Parcela', value: fmtDate(m.dueDate) },
  ]);

  doc.setFont('helvetica', 'bold'); doc.setFontSize(8.5); doc.setTextColor('#94A3B8');
  doc.text('SIMULAÇÃO FISCAL', marginX, y);
  y += 8;
  y = espelhoStatRow(doc, marginX, maxW, y, [
    { label: `Juros (${m.annualInterestPct}% a.a.)`, value: formatCurrency(m.juros) },
    { label: `Parcela calculada (${m.parcelas}x)`, value: m.installmentValue > 0 ? formatCurrency(m.installmentValue) : '—' },
    { label: 'IOF total', value: m.iofAplicavel ? formatCurrency(m.iof) : 'Não incide', tone: m.iofAplicavel ? 'blue' : 'slate' },
    { label: `IRRF s/ juros (${(m.irrfAliquota * 100).toFixed(1)}%)`, value: formatCurrency(m.irrfJuros), tone: 'rose' },
    { label: 'Total a devolver', value: formatCurrency(m.totalComJuros), tone: 'blue' },
  ]);
  y += 4;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#475569');
  if (m.installmentValue > 0) {
    const t = doc.splitTextToSize(`Parcela calculada = amortização ${formatCurrency(m.installmentAmortizacao)} + juros ${formatCurrency(m.installmentJuros)} (1ª parcela) — dos quais ${formatCurrency(m.installmentIrrf)} de IRRF retido na fonte sobre os juros.`, maxW);
    doc.text(t, marginX, y); y += t.length * 10.5 + 6;
  }
  if (m.iofAplicavel) {
    const darfCode = m.socioTipo === 'PF' ? '7893' : '1150';
    const t = doc.splitTextToSize(`IOF = fixo ${formatCurrency(m.iofFixo)} + diário ${formatCurrency(m.iofDiario)} · recolher via DARF, código ${darfCode}, até o 3º dia útil subsequente ao decêndio do fato gerador.`, maxW);
    doc.text(t, marginX, y); y += t.length * 10.5 + 6;
  }
  if (m.alertaSemJuros) {
    doc.setFillColor(255, 241, 242);
    const t = doc.splitTextToSize('Empréstimo da empresa ao sócio sem juros: risco de ser reclassificado como distribuição disfarçada de lucros.', maxW - 20);
    const boxH = t.length * 11 + 14;
    doc.roundedRect(marginX, y, maxW, boxH, 6, 6, 'F');
    doc.setTextColor('#BE123C'); doc.setFont('helvetica', 'bold');
    doc.text(t, marginX + 10, y + 15);
    doc.setTextColor('#475569'); doc.setFont('helvetica', 'normal');
    y += boxH + 8;
  }
  if (m.observacao) {
    doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor('#94A3B8');
    const t = doc.splitTextToSize(`"${m.observacao}"`, maxW);
    doc.text(t, marginX, y); y += t.length * 10.5 + 6;
  }

  y += 10;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#94A3B8');
  doc.text(`Gerado por Sistema JC Buarque em ${new Date().toLocaleString('pt-BR')}`, marginX, y);
  doc.setTextColor('#2B589A'); doc.setFont('helvetica', 'bold');
  doc.text('Autenticidade Garantida', pageW - marginX, y, { align: 'right' });

  return doc;
};

export const exportMutuoEspelhoPdf = (m: MutuoResumo) => {
  const doc = buildMutuoEspelhoDoc(m);
  doc.save(`espelho-mutuo-${m.fileBase}.pdf`);
};

// ---------- Demonstrativo PDF (memória de cálculo + tabela de amortização) ----------
export interface MutuoDemonstrativo extends MutuoResumo {
  schedule: MutuoScheduleRow[];
}

export const buildMutuoDemonstrativoDoc = (m: MutuoDemonstrativo): jsPDF => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const marginX = 40;
  const pageW = doc.internal.pageSize.getWidth();
  let y = 46;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(17); doc.setTextColor('#2B589A');
  doc.text('Demonstrativo do Mútuo', marginX, y);
  y += 20;
  doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor('#334155');
  const origem = m.direction === 'EMPRESA_PARA_SOCIO' ? m.empresaFantasia : m.socioNome;
  const destino = m.direction === 'EMPRESA_PARA_SOCIO' ? m.socioNome : m.empresaFantasia;
  doc.text(`${origem}  →  ${destino}`, marginX, y);
  y += 14;
  doc.setTextColor('#94A3B8');
  doc.text(`Contrato Nº ${formatMutuoNumero(m.numero, m.releaseDate)}`, marginX, y);
  doc.setTextColor('#334155');
  y += 20;

  autoTable(doc, {
    startY: y,
    head: [['Valor do Mútuo', 'Data Pago', 'Nº de Parcelas', 'Data 1ª Parcela', 'Data Última Parcela', 'Taxa (a.a.)']],
    body: [[
      formatCurrency(m.valor),
      fmtDate(m.releaseDate),
      String(m.parcelas),
      m.firstInstallmentDate ? fmtDate(m.firstInstallmentDate) : '—',
      fmtDate(m.dueDate),
      `${m.annualInterestPct}%`,
    ]],
    styles: { fontSize: 8.5, cellPadding: 6, halign: 'center' },
    headStyles: { fillColor: [237, 243, 251], textColor: [51, 65, 85], fontStyle: 'bold' },
    bodyStyles: { fontStyle: 'bold', textColor: [30, 41, 59] },
    margin: { left: marginX, right: marginX }
  });
  // @ts-ignore autotable anexa lastAutoTable
  y = (doc as any).lastAutoTable.finalY + 18;

  // Memória de cálculo — como cada tributo/encargo foi apurado sobre o total do contrato.
  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor('#334155');
  doc.text('Memória de Cálculo', marginX, y);
  y += 6;

  const memoriaRows: string[][] = [
    [`Juros (${m.annualInterestPct}% a.a. × ${m.dias} dias)`, formatCurrency(m.juros)],
  ];
  if (m.iofAplicavel) {
    memoriaRows.push(['IOF fixo (0,38%)', formatCurrency(m.iofFixo)]);
    memoriaRows.push([`IOF diário (${m.socioTipo === 'PF' ? '0,0082%/dia' : '0,0041%/dia'})`, formatCurrency(m.iofDiario)]);
    memoriaRows.push(['IOF total', formatCurrency(m.iof)]);
  } else {
    memoriaRows.push(['IOF', 'Não incide (sócio → empresa)']);
  }
  memoriaRows.push([`IRRF sobre juros (${(m.irrfAliquota * 100).toFixed(1)}%)`, formatCurrency(m.irrfJuros)]);
  memoriaRows.push(['Total a devolver (principal + juros)', formatCurrency(m.totalComJuros)]);

  autoTable(doc, {
    startY: y + 8,
    body: memoriaRows,
    theme: 'plain',
    styles: { fontSize: 8.5, cellPadding: { top: 3, bottom: 3, left: 8, right: 8 }, textColor: [71, 85, 105] },
    columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right', fontStyle: 'bold', textColor: [30, 41, 59] } },
    margin: { left: marginX, right: marginX }
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 18;

  doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.setTextColor('#334155');
  doc.text('Tabela de Amortização (Tabela Price)', marginX, y);
  y += 6;

  const totais = m.schedule.reduce((acc, r) => ({
    parcela: acc.parcela + r.valorParcela,
    amortizacao: acc.amortizacao + r.amortizacao,
    juros: acc.juros + r.juros,
    irrf: acc.irrf + r.irrf,
  }), { parcela: 0, amortizacao: 0, juros: 0, irrf: 0 });

  autoTable(doc, {
    startY: y + 8,
    head: [['Nº', 'Vencimento', 'Parcela', 'Amortização', 'Juros', 'IRRF', 'Saldo Devedor']],
    body: m.schedule.map(r => [
      String(r.numero),
      fmtDate(r.vencimento),
      formatCurrency(r.valorParcela),
      formatCurrency(r.amortizacao),
      formatCurrency(r.juros),
      formatCurrency(r.irrf),
      formatCurrency(r.saldoDevedor),
    ]),
    foot: [['', 'TOTAL', formatCurrency(totais.parcela), formatCurrency(totais.amortizacao), formatCurrency(totais.juros), formatCurrency(totais.irrf), '']],
    styles: { fontSize: 8, cellPadding: 5, halign: 'right' },
    headStyles: { fillColor: [43, 88, 154], textColor: 255, halign: 'right' },
    footStyles: { fillColor: [237, 243, 251], textColor: [51, 65, 85], fontStyle: 'bold', halign: 'right' },
    columnStyles: { 0: { halign: 'center', cellWidth: 26 }, 1: { halign: 'left' }, 5: { textColor: [225, 29, 72] } },
    margin: { left: marginX, right: marginX }
  });
  // @ts-ignore
  y = (doc as any).lastAutoTable.finalY + 20;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(7.5); doc.setTextColor('#94A3B8');
  const nota = doc.splitTextToSize('Parcela calculada pela Tabela Price (amortização + juros), taxa mensal derivada linearmente da SELIC anual informada. Estimativa operacional para acompanhamento do mútuo — não substitui as cláusulas do contrato, que seguem juros simples pro rata die sobre o total.', pageW - 2 * marginX);
  doc.text(nota, marginX, y);
  y += nota.length * 10 + 12;

  doc.setFont('helvetica', 'normal'); doc.setFontSize(8); doc.setTextColor('#94A3B8');
  doc.text(`Gerado por Sistema JC Buarque em ${new Date().toLocaleString('pt-BR')}`, marginX, y);
  doc.setTextColor('#2B589A'); doc.setFont('helvetica', 'bold');
  doc.text('Autenticidade Garantida', pageW - marginX, y, { align: 'right' });

  return doc;
};

export const exportMutuoDemonstrativoPdf = (m: MutuoDemonstrativo) => {
  const doc = buildMutuoDemonstrativoDoc(m);
  doc.save(`demonstrativo-mutuo-${m.fileBase}.pdf`);
};

export const exportMutuoContratoDocx = async (m: MutuoContrato) => {
  const { blocks, fileBase } = buildContratoBlocks(m);
  const children = blocks.flatMap(bl => {
    if (bl.kind === 'title') return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 60 }, children: [new TextRun({ text: bl.text, bold: true, size: 28, color: '2B589A' })] })];
    if (bl.kind === 'subtitle') return [new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: bl.text, size: 18, color: '64748B' })] })];
    if (bl.kind === 'note') return [new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: bl.text, italics: true, size: 16, color: '9A3412' })] })];
    if (bl.kind === 'heading') return [new Paragraph({ spacing: { before: 180, after: 60 }, children: [new TextRun({ text: bl.text, bold: true, size: 21 })] })];
    if (bl.kind === 'signrow') return [buildSignatureTable(bl.left, bl.right)];
    // Linhas em branco (padrão 2) — espaço para reserva/leitura antes de assinar.
    if (bl.kind === 'spacer') return Array.from({ length: bl.lines ?? 2 }, () => new Paragraph({ children: [] }));
    // Prefixo ("MUTUANTE:"/"MUTUÁRIO:") em negrito, resto do parágrafo normal.
    if (bl.kind === 'para-prefix') return [new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [
      new TextRun({ text: bl.prefix, bold: true, size: 20 }),
      new TextRun({ text: bl.rest, size: 20 })
    ] })];
    return [new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text: bl.text, size: 20 })] })];
  });
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `contrato-mutuo-${fileBase}.docx`);
};
