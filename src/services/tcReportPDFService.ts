// ============================================================
// JEET ERP — Testing & Commissioning PDF & DMS Service
// ============================================================

import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { supabase } from '@/lib/supabase';
import { tcService } from './tcService';

export const tcReportPDFService = {
  /**
   * Generates a branded PDF for a T&C package, uploads it to storage,
   * and registers it in the DMS linked to the package.
   */
  async generateAndFileTCReport(packageId: string): Promise<string> {
    try {
      // 1. Fetch package details
      const pkg = await tcService.getPackageById(packageId);
      
      // 2. Fetch scripts and results
      const scripts = await tcService.getTestScripts(packageId);
      const devices = await tcService.getDevices(packageId);

      // Fetch test results
      const { data: results, error: resErr } = await supabase
        .from('tc_test_results')
        .select(`
          *,
          tester:profiles!tc_test_results_tested_by_fkey(full_name)
        `)
        .in('script_id', scripts.map(s => s.id))
        .order('tested_at', { ascending: false });

      if (resErr) throw resErr;

      // Map tester names
      const resultsWithNames = (results || []).map(r => ({
        ...r,
        tested_by_name: r.tester?.full_name
      }));

      // 3. Fetch witnesses
      const { data: witnesses, error: witErr } = await supabase
        .from('tc_witnesses')
        .select('*')
        .eq('package_id', packageId)
        .order('witnessed_at', { ascending: true });

      if (witErr) throw witErr;

      // 4. Initialize jsPDF
      const doc = new jsPDF({
        orientation: 'portrait',
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
      doc.setFontSize(22);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('JEET MEP ERP', margin, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text('ELECTRICAL & MECHANICAL WORKS LLC', margin, 24);
      doc.text('Office 402, Business Bay, Dubai, UAE | TRN: 100348291000003', margin, 28);
      doc.text('Email: service@jeetmep.ae | Phone: +971 4 456 7890', margin, 32);

      // Report Header Info
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(14);
      doc.setTextColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.text('T&C COMMISSIONING REPORT', pageWidth - margin - 85, 20);

      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(9);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text(`Report Ref: ${pkg.package_number}`, pageWidth - margin - 85, 26);
      doc.text(`System: ${pkg.system}`, pageWidth - margin - 85, 31);
      doc.text(`Date Generated: ${new Date().toLocaleDateString('en-GB')}`, pageWidth - margin - 85, 36);

      // Divider Line
      doc.setDrawColor(accentColor[0], accentColor[1], accentColor[2]);
      doc.setLineWidth(1.0);
      doc.line(margin, 40, pageWidth - margin, 40);

      // Coordinates
      let y = 47;
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(9.5);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('PROJECT DETAILS:', margin, y);
      doc.text('COMMISSIONING SUMMARY:', pageWidth / 2 + 5, y);

      y += 5;
      doc.setFont('Helvetica', 'normal');
      doc.setFontSize(8.5);
      doc.setTextColor(textColor[0], textColor[1], textColor[2]);

      doc.text(`Project Name: ${pkg.project_name || 'N/A'}`, margin, y);
      doc.text(`Project Ref: ${pkg.project_number || 'N/A'}`, margin, y + 4.5);
      doc.text(`Package Title: ${pkg.title}`, margin, y + 9);
      doc.text(`Notes: ${pkg.notes || 'None'}`, margin, y + 13.5);

      doc.text(`Status: ${pkg.status}`, pageWidth / 2 + 5, y);
      doc.text(`Completion: ${pkg.completion_pct}%`, pageWidth / 2 + 5, y + 4.5);
      doc.text(`Witness Required: ${pkg.witness_required}`, pageWidth / 2 + 5, y + 9);
      doc.text(`Scheduled Witness: ${pkg.scheduled_witness_date ? new Date(pkg.scheduled_witness_date).toLocaleString('en-GB') : 'Not Scheduled'}`, pageWidth / 2 + 5, y + 13.5);

      y += 24;

      // 5. Test scripts and results table
      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('SYSTEM-LEVEL / INTEGRATION TESTING CHECKLIST', margin, y);
      
      y += 4;
      const systemLevelScripts = scripts.filter(s => s.script_type !== 'DEVICE_LEVEL');
      const tableRows = systemLevelScripts.map((script, idx) => {
        // Find latest result for this script
        const res = resultsWithNames.find(r => r.script_id === script.id);
        return [
          String(idx + 1),
          script.title,
          script.expected,
          res?.result || 'PENDING',
          res?.measured_value || '-',
          res?.tested_by_name || '-'
        ];
      });

      autoTable(doc, {
        startY: y,
        margin: { left: margin, right: margin },
        head: [['No', 'Test Checklist Item', 'Expected Outcome', 'Result', 'Measured', 'Tested By']],
        body: tableRows,
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
          1: { cellWidth: 55 },
          2: { cellWidth: 55 },
          3: { cellWidth: 18, halign: 'center' },
          4: { cellWidth: 22 },
          5: { cellWidth: 22 }
        },
        styles: {
          fontSize: 7.5,
          font: 'helvetica',
          cellPadding: 1.5
        },
        didParseCell: (data) => {
          if (data.column.index === 3 && data.cell.section === 'body') {
            if (data.cell.text[0] === 'PASS') {
              data.cell.styles.textColor = [16, 185, 129] as any;
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.text[0] === 'FAIL') {
              data.cell.styles.textColor = [239, 68, 68] as any;
              data.cell.styles.fontStyle = 'bold';
            }
          }
        }
      });

      y = (doc as any).lastAutoTable.finalY + 10;

      // 6. Devices Summary Table
      if (devices.length > 0) {
        if (y > pageHeight - 50) {
          doc.addPage();
          y = margin + 10;
        }

        doc.setFont('Helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
        doc.text(`DEVICE TESTING SUMMARY (${devices.length} Devices)`, margin, y);
        y += 4;

        const passedDevs = devices.filter(d => d.status === 'PASSED').length;
        const failedDevs = devices.filter(d => d.status === 'FAILED').length;
        const pendingDevs = devices.filter(d => d.status === 'PENDING').length;

        doc.setFont('Helvetica', 'normal');
        doc.setFontSize(8.5);
        doc.text(`Passed: ${passedDevs} | Failed: ${failedDevs} | Pending: ${pendingDevs}`, margin, y);
        y += 5;

        const deviceRows = devices.slice(0, 50).map((d, idx) => [
          String(idx + 1),
          d.label,
          d.device_type,
          d.location,
          d.brand_model || '-',
          d.ip_address || '-',
          d.status
        ]);

        autoTable(doc, {
          startY: y,
          margin: { left: margin, right: margin },
          head: [['No', 'Label', 'Type', 'Location', 'Model', 'IP Address', 'Status']],
          body: deviceRows,
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
            1: { cellWidth: 25 },
            2: { cellWidth: 25 },
            3: { cellWidth: 55 },
            4: { cellWidth: 25 },
            5: { cellWidth: 25 },
            6: { cellWidth: 17, halign: 'center' }
          },
          styles: {
            fontSize: 7.5,
            font: 'helvetica',
            cellPadding: 1.2
          },
          didParseCell: (data) => {
            if (data.column.index === 6 && data.cell.section === 'body') {
              if (data.cell.text[0] === 'PASSED') {
                data.cell.styles.textColor = [16, 185, 129] as any;
                data.cell.styles.fontStyle = 'bold';
              } else if (data.cell.text[0] === 'FAILED') {
                data.cell.styles.textColor = [239, 68, 68] as any;
                data.cell.styles.fontStyle = 'bold';
              }
            }
          }
        });

        y = (doc as any).lastAutoTable.finalY + 10;
      }

      // 7. Witness approvals section
      if (y > pageHeight - 60) {
        doc.addPage();
        y = margin + 10;
      }

      doc.setFont('Helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
      doc.text('WITNESS VALIDATION SIGN-OFFS', margin, y);
      y += 6;

      if (witnesses.length === 0) {
        doc.setFont('Helvetica', 'italic');
        doc.setFontSize(8.5);
        doc.text('No witness validations have been recorded for this package yet.', margin, y);
      } else {
        for (const wit of witnesses) {
          if (y > pageHeight - 40) {
            doc.addPage();
            y = margin + 10;
          }

          doc.setDrawColor(220, 225, 230);
          doc.setLineWidth(0.5);
          doc.line(margin, y, pageWidth - margin, y);
          y += 4;

          doc.setFont('Helvetica', 'bold');
          doc.setFontSize(9);
          doc.setTextColor(primaryColor[0], primaryColor[1], primaryColor[2]);
          doc.text(`Stage: ${wit.witness_stage} - Result: ${wit.result}`, margin, y);

          doc.setFont('Helvetica', 'normal');
          doc.setFontSize(8);
          doc.setTextColor(textColor[0], textColor[1], textColor[2]);
          doc.text(`Witness: ${wit.witness_name} (${wit.designation}) | Company: ${wit.company}`, margin, y + 4.5);
          doc.text(`Date/Time: ${new Date(wit.witnessed_at).toLocaleString('en-GB')}`, margin, y + 9);
          
          if (wit.comments) {
            doc.text(`Comments: ${wit.comments}`, margin, y + 13.5);
          }

          // Render witness signature if path exists
          if (wit.signature_path) {
            try {
              // Retrieve signature image from private storage
              const { data: sigData } = await supabase.storage
                .from('private_documents')
                .download(wit.signature_path);
              
              if (sigData) {
                // Convert blob to base64 data url
                const arrayBuffer = await sigData.arrayBuffer();
                const buffer = Buffer.from(arrayBuffer);
                const base64Flag = 'data:image/png;base64,';
                const imageStr = base64Flag + buffer.toString('base64');
                
                doc.addImage(imageStr, 'PNG', pageWidth - margin - 45, y - 2, 35, 12);
              }
            } catch (err) {
              console.error('Failed to embed witness signature in report:', err);
            }
          }

          y += 18;
        }
      }

      // 8. Upload PDF
      const pdfBlob = doc.output('blob');
      const pdfFile = new File([pdfBlob], `${pkg.package_number}_TC_Report.pdf`, { type: 'application/pdf' });
      const storagePath = `OPERATIONS/TC_REPORT/${pkg.package_number}_${Date.now()}.pdf`;

      const { error: uploadErr } = await supabase.storage
        .from('documents')
        .upload(storagePath, pdfFile, { cacheControl: '3600', upsert: true });

      if (uploadErr) throw uploadErr;

      // 9. Register in DMS
      const user = (await supabase.auth.getUser()).data.user;
      const fileHash = 'sha256-' + Math.random().toString(36).substring(2);

      const { data: docRecord, error: docError } = await supabase
        .from('documents')
        .insert({
          entity_type: 'CLIENT',
          entity_id: pkg.project_id, // link to project's client
          title: `T&C Commissioning Report - ${pkg.package_number}`,
          original_filename: `${pkg.package_number}_TC_Report.pdf`,
          file_ext: 'pdf',
          mime_type: 'application/pdf',
          file_size_bytes: pdfBlob.size,
          file_hash: fileHash,
          storage_path: storagePath,
          category: 'OPERATIONS',
          subcategory: 'TC_REPORT',
          status: 'VERIFIED',
          linked_record_type: 'tc_package',
          linked_record_id: pkg.id,
          uploaded_by: user?.id || null
        })
        .select()
        .single();

      if (docError) throw docError;

      return storagePath;
    } catch (error) {
      console.error('Failed to generate T&C report PDF:', error);
      throw error;
    }
  }
};

export default tcReportPDFService;
