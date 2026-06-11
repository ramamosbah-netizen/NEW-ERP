// ============================================================
// JEET ERP — Handover Closeout Certificate PDF Service
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { handoverService } from './handoverService';
import settingsService from './settingsService';

export const handoverCertPDFService = {
  /**
   * Generates a branded Handover Certificate PDF, uploads it,
   * registers it in DMS, and links it back to the handover package.
   */
  async generateAndFileHandoverCertificate(projectId: string): Promise<string> {
    try {
      // 1. Fetch handover package details
      const { data: { user } } = await supabase.auth.getUser();
      const pkg = await handoverService.getHandoverPackage(projectId);
      if (!pkg) throw new Error('Handover package not found');

      // Fetch project and client details
      const { data: project, error: projErr } = await supabase
        .from('projects')
        .select('*, client:clients(*)')
        .eq('id', projectId)
        .single();

      if (projErr) throw projErr;

      // 2. Initialize jsPDF
      const doc = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });

      const primaryColor = [15, 23, 42];  // Slate 900
      let accentColor = [0, 229, 160];   // Electric Mint
      let goldColor = [197, 160, 89];    // Metallic Gold
      const textColor = [51, 65, 85];      // Slate 700
      const pageWidth = doc.internal.pageSize.width;
      const pageHeight = doc.internal.pageSize.height;
      const margin = 20;

      // Dynamic config overrides
      let headerTitle = 'JEET MEP ERP';
      let headerSubtitle = 'ELECTRICAL & MECHANICAL WORKS LLC';
      let disclaimer = 'TRN: 100348291000003 | Dubai, United Arab Emirates';

      try {
        const templates = await settingsService.getDocumentTemplates();
        headerTitle = templates.header_title || headerTitle;
        headerSubtitle = templates.header_subtitle || headerSubtitle;
        disclaimer = templates.handover_disclaimer || disclaimer;
        if (templates.accent_color === 'slate') {
          accentColor = [15, 23, 42];
          goldColor = [51, 65, 85];
        } else if (templates.accent_color === 'gold') {
          accentColor = [197, 160, 89];
          goldColor = [197, 160, 89];
        } else if (templates.accent_color === 'red') {
          accentColor = [239, 68, 68];
          goldColor = [239, 68, 68];
        } else if (templates.accent_color === 'mint') {
          accentColor = [0, 229, 160];
          goldColor = [197, 160, 89];
        }
      } catch (e) {
        console.warn('Could not load document templates settings, using defaults:', e);
      }

      // --- Decorative Border (Premium Branded Feel) ---
      doc.setDrawColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.setLineWidth(0.8);
      doc.rect(8, 8, pageWidth - 16, pageHeight - 16);
      doc.rect(10, 10, pageWidth - 20, pageHeight - 20);

      // Header Brand
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(20);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(headerTitle, margin + 5, 28);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(headerSubtitle, margin + 5, 32);

      const splitDisclaimer = doc.splitTextToSize(disclaimer, pageWidth / 2 - 15);
      doc.text(splitDisclaimer, margin + 5, 36);

      // Certificate Title
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(18);
      doc.setTextColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.text('PROJECT HANDOVER CERTIFICATE', pageWidth - margin - 105, 28);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Certificate Ref: JI-HOC-${project.project_number}`, pageWidth - margin - 105, 34);
      doc.text(`Date of Issue: ${pkg.handover_date ? new Date(pkg.handover_date).toLocaleDateString('en-GB') : new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 105, 38.5);

      // Divider Line
      doc.setDrawColor(goldColor[0], goldColor[1], goldColor[2]);
      doc.setLineWidth(1.0);
      doc.line(margin + 5, 43, pageWidth - margin - 5, 43);

      let y = 52;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(11);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('PROJECT COMPLETION STATEMENT:', margin + 5, y);

      y += 6;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      const statementText = `This document certifies that the installation, testing, and commissioning works for project "${project.name}" (Ref: ${project.project_number}) have been completed by JEET MEP in accordance with the contract terms, engineering designs, and Dubai local authority compliance criteria. The project is officially handed over to the Client, starting the Defects Liability Period (DLP).`;
      const splitStatement = doc.splitTextToSize(statementText, pageWidth - 2 * margin - 10);
      doc.text(splitStatement, margin + 5, y);

      y += splitStatement.length * 5 + 6;

      // Project Specs Table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('PROJECT & DLP TERMS SUMMARY:', margin + 5, y);

      y += 4;
      const dlpMonths = project.dlp_months || 12;
      const specsRows = [
        ['Client Name', project.client_name],
        ['Site Address', project.site_address || 'N/A'],
        ['Project Scope Type', project.project_type],
        ['DLP Warranty Duration', `${dlpMonths} Months`],
        ['DLP Start Date', project.dlp_start_date ? new Date(project.dlp_start_date).toLocaleDateString('en-GB') : 'N/A'],
        ['DLP End Date', project.dlp_end_date ? new Date(project.dlp_end_date).toLocaleDateString('en-GB') : 'N/A']
      ];

      autoTable(doc, {
        startY: y,
        margin: { left: margin + 5, right: margin + 5 },
        body: specsRows,
        theme: 'plain',
        columnStyles: {
          0: { cellWidth: 50, fontStyle: 'bold', fontSize: 8.5 },
          1: { cellWidth: 110, fontSize: 8.5 }
        },
        styles: {
          cellPadding: 2,
          lineColor: [240, 240, 240],
          lineWidth: 0.5
        }
      });

      y = (doc as any).lastAutoTable.finalY + 8;

      // Checklist section
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('CLOSEOUT CHECKLIST AUDIT:', margin + 5, y);

      y += 4;
      const checklistRows = (pkg.checklist_items || []).map((item, idx) => [
        String(idx + 1),
        item.category,
        item.requirement,
        item.status === 'DONE' ? 'Verified' : item.status === 'WAIVED' ? 'Waived' : 'Pending',
        item.waived_reason || '-'
      ]);

      autoTable(doc, {
        startY: y,
        margin: { left: margin + 5, right: margin + 5 },
        head: [['No', 'Category', 'Requirement Description', 'Audit Status', 'Remarks / Waived Reason']],
        body: checklistRows,
        theme: 'grid',
        headStyles: {
          fillColor: [15, 23, 42] as any,
          textColor: [255, 255, 255] as any,
          font: 'helvetica',
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 20 },
          2: { cellWidth: 70 },
          3: { cellWidth: 20, halign: 'center' },
          4: { cellWidth: 42 }
        },
        styles: {
          fontSize: 7.5,
          font: 'helvetica',
          cellPadding: 1.5
        },
        didParseCell: (data) => {
          if (data.column.index === 3 && data.cell.section === 'body') {
            if (data.cell.text[0] === 'Verified') {
              data.cell.styles.textColor = [16, 185, 129] as any;
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.text[0] === 'Waived') {
              data.cell.styles.textColor = [197, 160, 89] as any;
              data.cell.styles.fontStyle = 'bold';
            } else {
              data.cell.styles.textColor = [239, 68, 68] as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      // Sign-off Block (Always at bottom)
      const sigY = pageHeight - 42;
      const sigWidth = (pageWidth - 2 * margin - 10) / 2;

      doc.setDrawColor(200, 200, 200);
      doc.setLineWidth(0.3);

      // Left Column: JEET Representative Sign-Off
      doc.line(margin + 5, sigY, margin + 5 + sigWidth - 10, sigY);
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(8.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('JEET MEP Projects Director', margin + 5, sigY + 4);
      doc.setFont('Helvetica', 'normal');
      doc.text('JEET Mechanical & Electrical LLC', margin + 5, sigY + 8);

      // Right Column: Client Representative Sign-Off
      const clientSigStartX = margin + 5 + sigWidth + 5;
      doc.line(clientSigStartX, sigY, pageWidth - margin - 5, sigY);
      doc.setFont('Helvetica', 'bold');
      doc.text('Client Authorized Sign-Off', clientSigStartX, sigY + 4);
      doc.setFont('Helvetica', 'normal');
      doc.text(`Name: ${pkg.client_signatory_name || 'N/A'}`, clientSigStartX, sigY + 8);
      doc.text(`Designation: ${pkg.client_signatory_designation || 'N/A'}`, clientSigStartX, sigY + 12);

      // Embed client signature if exists
      if (pkg.signature_path) {
        try {
          const { data: sigData } = await supabase.storage
            .from('private_documents')
            .download(pkg.signature_path);
          
          if (sigData) {
            const arrayBuffer = await sigData.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            const base64Flag = 'data:image/png;base64,';
            const imageStr = base64Flag + buffer.toString('base64');
            
            doc.addImage(imageStr, 'PNG', clientSigStartX + 10, sigY - 22, 45, 18);
          }
        } catch (err) {
          console.error('Failed to embed client signature in Handover certificate:', err);
        }
      }

      // 4. Save and Upload PDF to Supabase Storage
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `Handover_Cert_${project.project_number}.pdf`, { type: 'application/pdf' });
      const storagePath = `CONTRACTS/HANDOVER_CERT/Handover_Cert_${project.project_number}_${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      // 5. Create DMS document record
      const fileHash = 'sha256-' + Math.random().toString(36).substring(2);

      const { data: document, error: docError } = await supabase
        .from('documents')
        .insert({
          entity_type: 'CLIENT',
          entity_id: project.client_id,
          title: `Project Handover Certificate - ${project.name}`,
          original_filename: `Handover_Cert_${project.project_number}.pdf`,
          file_ext: 'pdf',
          mime_type: 'application/pdf',
          file_size_bytes: pdfBlob.size,
          file_hash: fileHash,
          storage_path: storagePath,
          category: 'CONTRACT',
          subcategory: 'HANDOVER_CERT',
          status: 'VERIFIED',
          linked_record_type: 'handover_package',
          linked_record_id: pkg.id,
          uploaded_by: user?.id || null
        })
        .select()
        .single();

      if (docError) throw docError;

      // 6. Link document ID back to handover package
      const { error: linkErr } = await supabase
        .from('handover_packages')
        .update({
          certificate_document_id: document.id
        })
        .eq('id', pkg.id);

      if (linkErr) throw linkErr;

      return storagePath;
    } catch (error) {
      console.error('Failed to generate Handover Certificate PDF:', error);
      throw error;
    }
  }
};

export default handoverCertPDFService;
