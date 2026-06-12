// ============================================================
// JEET ERP — Snag List Export Service
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { snagService } from './snagService';

export const snagExportService = {
  /**
   * Generates a PDF report containing the complete snag list for a project.
   */
  async exportSnagsToPDF(projectId: string): Promise<string> {
    try {
      // 1. Fetch snags
      const snags = await snagService.getSnagsByProject(projectId);

      // Fetch project
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('name, project_number')
        .eq('id', projectId)
        .single();

      if (projErr) throw projErr;

      // 2. Initialize jsPDF
      const doc = new jsPDF({
        orientation: 'landscape', // Landscape for wider snag tables
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [15, 23, 42]; // Slate 900
      const accentColor = [37, 99, 235];  // Electric Mint
      const textColor = [51, 65, 85];    // Slate 700
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      // Header Brand
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('JEET MEP ERP', margin, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003', margin, 24);

      // Report Header Info
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('PROJECT SNAG / PUNCH LIST REGISTER', pageWidth - margin - 100, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Project Name: ${project.name} (Ref: ${project.project_number})`, pageWidth - margin - 100, 25);
      doc.text(`Generated On: ${new Date().toLocaleDateString('en-GB')} | Total Snags: ${snags.length}`, pageWidth - margin - 100, 29.5);

      // Divider Line
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(1.0);
      doc.line(margin, 34, pageWidth - margin, 34);

      let y = 42;

      // 3. Status Summary Metrics
      const total = snags.length;
      const open = snags.filter(s => s.status === 'OPEN').length;
      const inProgress = snags.filter(s => s.status === 'IN_PROGRESS').length;
      const ready = snags.filter(s => s.status === 'READY_FOR_INSPECTION').length;
      const closed = snags.filter(s => s.status === 'CLOSED').length;
      const deferred = snags.filter(s => s.status === 'DEFERRED_TO_DLP').length;

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Snag Summary:`, margin, y);

      doc.setFont('Helvetica', 'normal');
      doc.text(`Open: ${open}  |  In Progress: ${inProgress}  |  Ready for Inspection: ${ready}  |  Closed: ${closed}  |  Deferred to DLP: ${deferred}  |  Total: ${total}`, margin + 25, y);

      y += 6;

      // 4. Snags Table
      const tableRows = snags.map((s, idx) => [
        s.snag_number,
        s.severity,
        s.system,
        s.location,
        s.description,
        s.assigned_to_name || s.subcontractor_name || '-',
        s.target_date ? new Date(s.target_date).toLocaleDateString('en-GB') : '-',
        s.status.replace(/_/g, ' ')
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['Ref #', 'Severity', 'System', 'Location', 'Defect Description', 'Assigned To / Trade', 'Target Date', 'Status']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42] as any,
          textColor: [255, 255, 255] as any,
          font: 'helvetica',
          fontStyle: 'bold',
          fontSize: 8.5,
        },
        columnStyles: {
          0: { cellWidth: 20, halign: 'center' },
          1: { cellWidth: 20, halign: 'center' },
          2: { cellWidth: 25 },
          3: { cellWidth: 35 },
          4: { cellWidth: 80 },
          5: { cellWidth: 35 },
          6: { cellWidth: 22, halign: 'center' },
          7: { cellWidth: 30, halign: 'center' }
        },
        styles: {
          fontSize: 8,
          font: 'helvetica',
          cellPadding: 1.5
        },
        didParseCell: (data) => {
          // Color code severity and status
          if (data.cell.section === 'body') {
            if (data.column.index === 1) { // Severity
              if (data.cell.text[0] === 'CRITICAL') {
                data.cell.styles.textColor = [220, 38, 38] as any; // Bright Red
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.text[0] === 'MAJOR') {
                data.cell.styles.textColor = [217, 119, 6] as any; // Amber/Orange
                data.cell.styles.fontStyle = 'bold';
              }
            } else if (data.column.index === 7) { // Status
              if (data.cell.text[0] === 'CLOSED') {
                data.cell.styles.textColor = [16, 185, 129] as any; // Green
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.text[0] === 'READY FOR INSPECTION') {
                data.cell.styles.textColor = [59, 130, 246] as any; // Blue
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.text[0] === 'DEFERRED TO DLP') {
                data.cell.styles.textColor = [197, 160, 89] as any; // Gold
              }
            }
          }
        }
      });

      // 5. Output PDF
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `Snag_List_${project.project_number}.pdf`, { type: 'application/pdf' });
      const storagePath = `OPERATIONS/SNAG_REPORTS/Snag_List_${project.project_number}_${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      return storagePath;
    } catch (error) {
      console.error('Failed to export snags PDF:', error);
      throw error;
    }
  }
};

export default snagExportService;
