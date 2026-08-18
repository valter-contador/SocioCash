
import * as XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Document, Packer, Paragraph, TextRun, AlignmentType } from 'docx';
import { formatCurrency } from './dataService';

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

// ---------- Contrato de Mútuo (PDF) ----------
export interface MutuoContrato {
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

type ContratoBlock = { kind: 'title' | 'note' | 'para' | 'heading' | 'sign'; text: string };

// Monta o conteúdo do contrato uma única vez (usado tanto no PDF quanto no DOCX).
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
  b.push({ kind: 'note', text: 'MINUTA para conferência jurídica/contábil. Recomenda-se assinatura com firma reconhecida ou assinatura digital, e escrituração nas contabilidades de ambas as partes.' });
  b.push({ kind: 'para', text: 'Pelo presente instrumento particular, as partes a seguir qualificadas:' });
  b.push({ kind: 'para', text: `MUTUANTE: ${mutuante}; e` });
  b.push({ kind: 'para', text: `MUTUÁRIO(A): ${mutuario}.` });
  b.push({ kind: 'para', text: 'têm entre si, justo e contratado, o presente Contrato de Mútuo, que se regerá pelas cláusulas e condições seguintes, nos termos dos artigos 586 e seguintes do Código Civil.' });
  b.push({ kind: 'heading', text: 'CLÁUSULA 1ª — DO OBJETO' });
  b.push({ kind: 'para', text: `O(A) MUTUANTE entrega ao(à) MUTUÁRIO(A), a título de mútuo, a quantia de ${formatCurrency(m.valor)}, disponibilizada por transferência/crédito em conta em ${fmtDate(m.releaseDate)}.` });
  b.push({ kind: 'heading', text: 'CLÁUSULA 2ª — DO PRAZO E DA RESTITUIÇÃO' });
  b.push({ kind: 'para', text: `O valor será restituído no prazo de ${m.dias} dia(s), com vencimento final em ${fmtDate(m.dueDate)}, ${m.parcelas > 1 ? `em ${m.parcelas} (${m.parcelas}) parcelas mensais e sucessivas` : 'em parcela única no vencimento'}. Não havendo prazo estipulado, presume-se o vencimento na forma do art. 592 do Código Civil.` });
  b.push({ kind: 'heading', text: 'CLÁUSULA 3ª — DOS JUROS' });
  if (oneroso) {
    b.push({ kind: 'para', text: `Sobre o valor mutuado incidirão juros remuneratórios à taxa de ${m.annualInterestPct}% ao ano (taxa SELIC), calculados de forma simples e pro rata die pelo período de ${m.dias} dia(s), correspondendo a ${formatCurrency(m.juros)}, totalizando ${formatCurrency(m.totalComJuros)} a serem restituídos.` });
  } else {
    b.push({ kind: 'para', text: `Restitui-se o valor principal de ${formatCurrency(m.valor)} na forma ajustada entre as partes.` });
  }
  b.push({ kind: 'heading', text: 'CLÁUSULA 4ª — DOS TRIBUTOS' });
  const tributos: string[] = [];
  if (m.iofAplicavel) tributos.push(`Por se tratar de mútuo concedido por pessoa jurídica, incide o IOF no valor de ${formatCurrency(m.iof)}, de responsabilidade do(a) MUTUANTE, a ser recolhido via DARF até o 20º dia do mês subsequente ao da operação.`);
  else tributos.push(`Não há incidência de IOF corporativo, por se tratar de mútuo concedido por pessoa física à pessoa jurídica.`);
  if (oneroso) tributos.push(`Sobre os juros incide o Imposto de Renda Retido na Fonte à alíquota de ${(m.irrfAliquota * 100).toFixed(1)}% (${formatCurrency(m.irrfJuros)}), conforme o prazo da operação, retido por ocasião do pagamento/crédito dos rendimentos.`);
  b.push({ kind: 'para', text: tributos.join(' ') });
  b.push({ kind: 'heading', text: 'CLÁUSULA 5ª — DO VENCIMENTO ANTECIPADO' });
  b.push({ kind: 'para', text: 'Ocorrerá o vencimento antecipado da dívida, independentemente de aviso ou notificação, na hipótese de inadimplemento de qualquer obrigação aqui prevista, observada a legislação aplicável.' });
  b.push({ kind: 'heading', text: 'CLÁUSULA 6ª — DO FORO' });
  b.push({ kind: 'para', text: `Fica eleito o foro da comarca de ${m.foroComarca || '____________________'} para dirimir quaisquer controvérsias oriundas do presente contrato.` });
  if (m.observacao) { b.push({ kind: 'heading', text: 'OBSERVAÇÕES' }); b.push({ kind: 'para', text: m.observacao }); }
  b.push({ kind: 'para', text: 'E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.' });
  b.push({ kind: 'para', text: `${m.foroComarca || '____________________'}, ${dataExtenso()}.` });
  b.push({ kind: 'sign', text: 'MUTUANTE' });
  b.push({ kind: 'sign', text: 'MUTUÁRIO(A)' });
  b.push({ kind: 'sign', text: 'Testemunha 1 — Nome / CPF' });
  b.push({ kind: 'sign', text: 'Testemunha 2 — Nome / CPF' });

  const fileBase = empresaEhMutuante ? `${slug(m.empresaFantasia)}-para-${slug(m.socioNome)}` : `${slug(m.socioNome)}-para-${slug(m.empresaFantasia)}`;
  return { blocks: b, fileBase };
};

export const exportMutuoContratoPdf = (m: MutuoContrato) => {
  const { blocks, fileBase } = buildContratoBlocks(m);
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 52;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * margin;
  let y = margin;
  const ensure = (space: number) => { if (y + space > pageH - margin) { doc.addPage(); y = margin; } };

  blocks.forEach(bl => {
    if (bl.kind === 'title') {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#2B589A');
      doc.text(bl.text, pageW / 2, y, { align: 'center' }); y += 22; doc.setTextColor('#111111');
    } else if (bl.kind === 'note') {
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor('#9a3412');
      const lines = doc.splitTextToSize(bl.text, maxW); ensure(lines.length * 11 + 10);
      doc.text(lines, margin, y); y += lines.length * 11 + 10; doc.setTextColor('#111111');
    } else if (bl.kind === 'heading') {
      ensure(22); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5); doc.text(bl.text, margin, y); y += 15;
    } else if (bl.kind === 'sign') {
      ensure(46); doc.line(margin, y, margin + 250, y); y += 12;
      doc.setFont('helvetica', 'normal'); doc.setFontSize(9); doc.text(bl.text, margin, y); y += 22;
    } else {
      doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
      const lines = doc.splitTextToSize(bl.text, maxW); ensure(lines.length * 14 + 10);
      doc.text(lines, margin, y); y += lines.length * 14 + 10;
    }
  });

  doc.save(`contrato-mutuo-${fileBase}.pdf`);
};

export const exportMutuoContratoDocx = async (m: MutuoContrato) => {
  const { blocks, fileBase } = buildContratoBlocks(m);
  const children = blocks.map(bl => {
    if (bl.kind === 'title') return new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 220 }, children: [new TextRun({ text: bl.text, bold: true, size: 28, color: '2B589A' })] });
    if (bl.kind === 'note') return new Paragraph({ spacing: { after: 180 }, children: [new TextRun({ text: bl.text, italics: true, size: 16, color: '9A3412' })] });
    if (bl.kind === 'heading') return new Paragraph({ spacing: { before: 180, after: 60 }, children: [new TextRun({ text: bl.text, bold: true, size: 21 })] });
    if (bl.kind === 'sign') return new Paragraph({ spacing: { before: 240, after: 40 }, children: [new TextRun({ text: '________________________________________', size: 20 }), new TextRun({ text: bl.text, size: 18, break: 1 })] });
    return new Paragraph({ alignment: AlignmentType.JUSTIFIED, spacing: { after: 120 }, children: [new TextRun({ text: bl.text, size: 20 })] });
  });
  const doc = new Document({ sections: [{ properties: {}, children }] });
  const blob = await Packer.toBlob(doc);
  downloadBlob(blob, `contrato-mutuo-${fileBase}.docx`);
};
