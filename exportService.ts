
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

export const exportMutuoContratoPdf = (m: MutuoContrato) => {
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const margin = 52;
  const pageW = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  const maxW = pageW - 2 * margin;
  let y = margin;

  const ensure = (space: number) => { if (y + space > pageH - margin) { doc.addPage(); y = margin; } };
  const para = (t: string, gap = 10) => {
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
    const lines = doc.splitTextToSize(t, maxW);
    ensure(lines.length * 14 + gap);
    doc.text(lines, margin, y);
    y += lines.length * 14 + gap;
  };
  const heading = (t: string) => {
    ensure(22); doc.setFont('helvetica', 'bold'); doc.setFontSize(10.5);
    doc.text(t, margin, y); y += 15;
  };
  const oneroso = m.annualInterestPct > 0;

  // Papéis (mutuante = quem empresta)
  const empresaEhMutuante = m.direction === 'EMPRESA_PARA_SOCIO';
  const empresaQualif = `${m.empresaRazao}, pessoa jurídica de direito privado, inscrita no CNPJ sob o nº ${m.empresaCnpj || '____________________'}, com sede em ${m.empresaEndereco || '____________________'}`;
  const docLabelSocio = m.socioTipo === 'PF' ? 'CPF' : 'CNPJ';
  const socioQualif = `${m.socioNome}, ${m.socioTipo === 'PF' ? 'pessoa física' : 'pessoa jurídica'}, inscrito(a) no ${docLabelSocio} sob o nº ${m.socioCpf || '____________________'}, residente/domiciliado(a) em ${m.socioEndereco || '____________________'}`;
  const mutuante = empresaEhMutuante ? empresaQualif : socioQualif;
  const mutuario = empresaEhMutuante ? socioQualif : empresaQualif;

  // Título
  doc.setFont('helvetica', 'bold'); doc.setFontSize(14); doc.setTextColor('#2B589A');
  doc.text(`CONTRATO DE MÚTUO ${oneroso ? 'FENERATÍCIO' : 'GRATUITO'}`, pageW / 2, y, { align: 'center' });
  y += 22;
  doc.setTextColor('#111111');

  // Aviso de minuta
  doc.setFont('helvetica', 'italic'); doc.setFontSize(8); doc.setTextColor('#9a3412');
  const aviso = doc.splitTextToSize('MINUTA para conferência jurídica/contábil. Recomenda-se assinatura com firma reconhecida ou assinatura digital, e escrituração nas contabilidades de ambas as partes. Valores tributários indicativos.', maxW);
  doc.text(aviso, margin, y); y += aviso.length * 11 + 10;
  doc.setTextColor('#111111'); doc.setFont('helvetica', 'normal');

  para(`Pelo presente instrumento particular, as partes a seguir qualificadas:`);
  para(`MUTUANTE: ${mutuante}; e`);
  para(`MUTUÁRIO(A): ${mutuario}.`);
  para(`têm entre si, justo e contratado, o presente Contrato de Mútuo, que se regerá pelas cláusulas e condições seguintes, nos termos dos artigos 586 e seguintes do Código Civil.`);

  heading('CLÁUSULA 1ª — DO OBJETO');
  para(`O(A) MUTUANTE entrega ao(à) MUTUÁRIO(A), a título de mútuo, a quantia de ${formatCurrency(m.valor)}, disponibilizada por transferência/crédito em conta em ${fmtDate(m.releaseDate)}.`);

  heading('CLÁUSULA 2ª — DO PRAZO E DA RESTITUIÇÃO');
  para(`O valor será restituído no prazo de ${m.dias} dia(s), com vencimento final em ${fmtDate(m.dueDate)}, ${m.parcelas > 1 ? `em ${m.parcelas} (${m.parcelas}) parcelas mensais e sucessivas` : 'em parcela única no vencimento'}. Não havendo prazo estipulado, presume-se o vencimento na forma do art. 592 do Código Civil.`);

  heading('CLÁUSULA 3ª — DOS JUROS');
  if (oneroso) {
    para(`Sobre o valor mutuado incidirão juros remuneratórios à taxa de ${m.annualInterestPct}% ao ano, calculados de forma simples e pro rata die pelo período de ${m.dias} dia(s), correspondendo a ${formatCurrency(m.juros)}, totalizando ${formatCurrency(m.totalComJuros)} a serem restituídos.`);
  } else {
    para(`O presente mútuo é gratuito, não incidindo juros remuneratórios, restituindo-se o valor principal de ${formatCurrency(m.valor)}.`);
  }

  heading('CLÁUSULA 4ª — DOS TRIBUTOS');
  const tributos: string[] = [];
  if (m.iofAplicavel) {
    tributos.push(`Por se tratar de mútuo concedido por pessoa jurídica, incide o IOF no valor de ${formatCurrency(m.iof)}, de responsabilidade do(a) MUTUANTE, a ser recolhido via DARF até o 20º dia do mês subsequente ao da operação.`);
  } else {
    tributos.push(`Não há incidência de IOF corporativo, por se tratar de mútuo concedido por pessoa física à pessoa jurídica.`);
  }
  if (oneroso) {
    tributos.push(`Sobre os juros incide o Imposto de Renda Retido na Fonte à alíquota de ${(m.irrfAliquota * 100).toFixed(1)}% (${formatCurrency(m.irrfJuros)}), conforme o prazo da operação, retido por ocasião do pagamento/crédito dos rendimentos.`);
  }
  para(tributos.join(' '));

  heading('CLÁUSULA 5ª — DO VENCIMENTO ANTECIPADO');
  para(`Ocorrerá o vencimento antecipado da dívida, independentemente de aviso ou notificação, na hipótese de inadimplemento de qualquer obrigação aqui prevista, observada a legislação aplicável.`);

  heading('CLÁUSULA 6ª — DO FORO');
  para(`Fica eleito o foro da comarca de ${m.foroComarca || '____________________'} para dirimir quaisquer controvérsias oriundas do presente contrato.`);

  if (m.observacao) { heading('OBSERVAÇÕES'); para(m.observacao); }

  para(`E, por estarem assim justas e contratadas, as partes assinam o presente instrumento em 2 (duas) vias de igual teor e forma, na presença das testemunhas abaixo.`, 16);
  para(`${m.foroComarca || '____________________'}, ${dataExtenso()}.`, 24);

  const assinatura = (rotulo: string) => {
    ensure(46);
    doc.line(margin, y, margin + 250, y); y += 12;
    doc.setFontSize(9); doc.text(rotulo, margin, y); y += 22; doc.setFontSize(10);
  };
  assinatura('MUTUANTE');
  assinatura('MUTUÁRIO(A)');
  assinatura('Testemunha 1 — Nome / CPF');
  assinatura('Testemunha 2 — Nome / CPF');

  const nomeArq = empresaEhMutuante ? `${slug(m.empresaFantasia)}-para-${slug(m.socioNome)}` : `${slug(m.socioNome)}-para-${slug(m.empresaFantasia)}`;
  doc.save(`contrato-mutuo-${nomeArq}.pdf`);
};
