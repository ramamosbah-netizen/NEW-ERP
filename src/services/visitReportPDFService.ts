// ============================================================
// JEET ERP — PPM Visit Report PDF & DMS Service
// Compiles, uploads, and files signed PPM Visit reports.
// ============================================================

import { logger } from '@/lib/logger';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import settingsService from './settingsService';

export const visitReportPDFService = {
  /**
   * Generates a branded PDF for a completed PPM visit, uploads it to storage,
   * creates a document record, and links it back to the visit.
   */
  async generateAndFileVisitReport(visitId: string): Promise<string> {
    try {
      // 1. Fetch complete visit data
      const { data: visit, error: visitErr } = await supabase
        .from('ppm_visits')
        .select('*, amc_contracts(*)')
        .eq('id', visitId)
        .single();

      if (visitErr) throw visitErr;
      if (!visit) throw new Error('PPM Visit not found');

      const contract = visit.amc_contracts;

      // 2. Fetch checklist results
      const { data: checklistResults, error: checkErr } = await supabase
        .from('ppm_visit_checklist_results')
        .select('*, checklist_template_items(item_text, item_type)')
        .eq('visit_id', visitId);

      if (checkErr) throw checkErr;

      // 3. Compile PDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [15, 23, 42]; // Slate 900
      let accentColor = [37, 99, 235];  // Electric UAE Mint
      const textColor = [51, 65, 85];    // Slate 700
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 15;

      // Dynamic config overrides
      let headerTitle = 'JEET MEP ERP';
      let headerSubtitle = 'ELECTRICAL & MECHANICAL WORKS LLC';
      let disclaimer = 'Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003\nEmail: service@jeetmep.ae | Phone: +971 4 456 7890';

      try {
        const templates = await settingsService.getDocumentTemplates();
        headerTitle = templates.header_title || headerTitle;
        headerSubtitle = templates.header_subtitle || headerSubtitle;
        disclaimer = templates.ppm_disclaimer || disclaimer;
        if (templates.accent_color === 'slate') accentColor = [15, 23, 42];
        else if (templates.accent_color === 'gold') accentColor = [197, 160, 89];
        else if (templates.accent_color === 'red') accentColor = [239, 68, 68];
        else if (templates.accent_color === 'mint') accentColor = [37, 99, 235];
      } catch (e) {
        logger.warn('Could not load document templates settings, using defaults:', e);
      }

      // Header Brand
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(headerTitle, margin, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(headerSubtitle, margin, 24);

      const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth / 2 - 10);
      doc.text(splitDisclaimer, margin, 28);

      // Report Header info
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('PPM MAINTENANCE REPORT', pageWidth - margin - 75, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Report Ref: ${visit.visit_number}`, pageWidth - margin - 75, 26);
      doc.text(`Scheduled Date: ${visit.scheduled_date ? new Date(visit.scheduled_date).toLocaleDateString('en-GB') : 'N/A'}`, pageWidth - margin - 75, 31);
      doc.text(`Completion Date: ${visit.completed_at ? new Date(visit.completed_at).toLocaleDateString('en-GB') : 'N/A'}`, pageWidth - margin - 75, 36);

      // Divider Line
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(1.0);
      doc.line(margin, 40, pageWidth - margin, 40);

      // Coordinates
      let y = 47;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('CLIENT & CONTRACT DETAILS:', margin, y);
      doc.text('VISIT SUMMARY:', pageWidth / 2 + 5, y);

      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      doc.text(`Client: ${contract?.client_name || 'N/A'}`, margin, y);
      doc.text(`Contract No: ${contract?.contract_number || 'N/A'}`, margin, y + 4.5);
      doc.text(`Site Name: ${contract?.site_name || 'N/A'}`, margin, y + 9);
      doc.text(`Site Address: ${contract?.site_address || 'N/A'}`, margin, y + 13.5);
      doc.text(`Emirate: ${contract?.emirate || 'N/A'}`, margin, y + 18);

      const statusMap = {
        UNSCHEDULED: 'Unscheduled',
        SCHEDULED: 'Scheduled',
        IN_PROGRESS: 'In Progress',
        COMPLETED: 'Completed',
        MISSED: 'Missed',
        CANCELLED: 'Cancelled'
      };
      doc.text(`Status: ${statusMap[visit.status as keyof typeof statusMap] || visit.status}`, pageWidth / 2 + 5, y);
      doc.text(`Slot: ${visit.scheduled_slot || 'N/A'}`, pageWidth / 2 + 5, y + 4.5);
      doc.text(`Time Started: ${visit.started_at ? new Date(visit.started_at).toLocaleTimeString('en-GB') : 'N/A'}`, pageWidth / 2 + 5, y + 9);
      doc.text(`Time Completed: ${visit.completed_at ? new Date(visit.completed_at).toLocaleTimeString('en-GB') : 'N/A'}`, pageWidth / 2 + 5, y + 13.5);

      // --- Checklist Results Table ---
      y += 24;

      const tableRows = (checklistResults || []).map((item, idx) => [
        String(idx + 1),
        item.checklist_template_items?.item_text || 'Checklist Item',
        item.result,
        item.value || '-',
        item.notes || '-'
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['No', 'Maintenance Verification Checklist Item', 'Result', 'Value/Reading', 'Notes/Observations']],
        body: tableRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42] as any,
          textColor: [255, 255, 255] as any,
          font: 'helvetica',
          fontStyle: 'bold',
          fontSize: 8,
          halign: 'left'
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 80 },
          2: { cellWidth: 15, halign: 'center' },
          3: { cellWidth: 32 },
          4: { cellWidth: 45 }
        },
        styles: {
          fontSize: 8,
          font: 'helvetica',
          cellPadding: 1.5
        },
        didParseCell: (data) => {
          // Color code results PASS vs FAIL
          if (data.column.index === 2 && data.cell.section === 'body') {
            if (data.cell.text[0] === 'PASS') {
              data.cell.styles.textColor = [16, 185, 129] as any; // Green
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.text[0] === 'FAIL') {
              data.cell.styles.textColor = [239, 68, 68] as any; // Red
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      // --- Summary and Recommendations ---
      let nextY = (doc as any).lastAutoTable.finalY + 8;

      if (nextY > pageHeight - 65) {
        doc.addPage();
        nextY = margin + 10;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('VISIT FINDINGS & RECOMMENDATIONS:', margin, nextY);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      const summaryText = visit.summary || 'PPM visit executed successfully without any major findings.';
      const recText = visit.recommendations || 'No corrective actions required at this time.';

      const splitSummary = doc.splitTextToSize(`Summary: ${summaryText}`, pageWidth - 2 * margin);
      doc.text(splitSummary, margin, nextY + 4);

      const summaryHeight = splitSummary.length * 4.5;

      const splitRec = doc.splitTextToSize(`Recommendations: ${recText}`, pageWidth - 2 * margin);
      doc.text(splitRec, margin, nextY + 6 + summaryHeight);

      // --- Sign-Offs Block (Always at bottom) ---
      const sigY = pageHeight - 40;

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);

      const sigWidth = (pageWidth - 2 * margin) / 2;

      // Left Column: Technician Signature
      doc.line(margin, sigY, margin + sigWidth - 10, sigY);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('Technician Signature', margin, sigY + 4);
      doc.setFont('Helvetica', 'normal');
      doc.text('JEET MEP Operations', margin, sigY + 8);

      // Right Column: Client Representative Sign-Off
      const clientSigStartX = margin + sigWidth + 5;
      doc.line(clientSigStartX, sigY, pageWidth - margin, sigY);
      doc.setFont('Helvetica', 'bold');
      doc.text('Client Representative Sign-Off', clientSigStartX, sigY + 4);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Name: ${visit.client_sign_name || 'N/A'}`, clientSigStartX, sigY + 8);
      doc.text(`Designation: ${visit.client_sign_designation || 'N/A'}`, clientSigStartX, sigY + 12);

      // Embed Client Signature Image if present
      if (visit.client_signature_storage_path && visit.client_signature_storage_path.startsWith('data:image')) {
        try {
          doc.addImage(
            visit.client_signature_storage_path,
            'PNG',
            clientSigStartX + 10,
            sigY - 20,
            40,
            15
          );
        } catch (imgErr) {
          logger.error('Failed to embed client signature into PDF:', imgErr);
        }
      }

      // 4. Save and Upload PDF to Supabase Storage
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `${visit.visit_number}.pdf`, { type: 'application/pdf' });
      const storagePath = `OPERATIONS/PPM_REPORT/${visit.visit_number}_${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      // 5. Create DMS document record
      const user = (await supabase.auth.getUser()).data.user;
      const fileHash = 'sha256-' + Math.random().toString(36).substring(2);

      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          entity_type: 'CLIENT',
          entity_id: contract?.client_id,
          title: `PPM Maintenance Report - ${visit.visit_number}`,
          original_filename: `${visit.visit_number}.pdf`,
          file_ext: 'pdf',
          mime_type: 'application/pdf',
          file_size_bytes: pdfBlob.size,
          file_hash: fileHash,
          storage_path: storagePath,
          category: 'OPERATIONS',
          subcategory: 'PPM_REPORT',
          status: 'VERIFIED',
          linked_record_type: 'ppm_visit',
          linked_record_id: visit.id,
          uploaded_by: user?.id || null
        })
        .select()
        .single();

      if (docError) throw docError;

      // 6. Link document ID back to PPM visit
      const { error: linkErr } = await supabase
        .from('ppm_visits')
        .update({
          report_document_id: document.id
        })
        .eq('id', visitId);

      if (linkErr) throw linkErr;

      return storagePath;
    } catch (error) {
      logger.error('Failed in generateAndFileVisitReport:', error);
      throw error;
    }
  }
};
export default visitReportPDFService;
