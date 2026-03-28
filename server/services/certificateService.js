const { PDFDocument, rgb, StandardFonts } = require('pdf-lib');
const fs = require('fs');
const path = require('path');

const CERT_DIR = path.join(__dirname, '..', 'certificates');
const UPLOADS_DIR = path.join(__dirname, '..', 'uploads', 'templates');

/**
 * Generate a certificate PDF for a student.
 * If an admin-uploaded template exists, overlay names on it.
 * Otherwise, generate a default template.
 */
async function generateCertificate({ studentName, teamName, eventTitle, eventDate, eventId, studentId, templatePath }) {
  const eventDir = path.join(CERT_DIR, eventId);
  if (!fs.existsSync(eventDir)) {
    fs.mkdirSync(eventDir, { recursive: true });
  }

  let pdfDoc;
  let page;
  let useUploadedTemplate = false;

  // Try to load admin-uploaded template
  if (templatePath) {
    const fullPath = path.join(__dirname, '..', templatePath);
    if (fs.existsSync(fullPath)) {
      const ext = path.extname(fullPath).toLowerCase();

      if (ext === '.pdf') {
        const templateBytes = fs.readFileSync(fullPath);
        pdfDoc = await PDFDocument.load(templateBytes);
        if (pdfDoc.getPageCount() > 0) {
          page = pdfDoc.getPage(0);
          useUploadedTemplate = true;
        }
      } else if (['.png', '.jpg', '.jpeg'].includes(ext)) {
        // Image template — embed into a landscape A4 PDF
        pdfDoc = await PDFDocument.create();
        page = pdfDoc.addPage([842, 595]);
        const imgBytes = fs.readFileSync(fullPath);
        let img;
        if (ext === '.png') {
          img = await pdfDoc.embedPng(imgBytes);
        } else {
          img = await pdfDoc.embedJpg(imgBytes);
        }
        page.drawImage(img, { x: 0, y: 0, width: 842, height: 595 });
        useUploadedTemplate = true;
      }
    }
  }

  // Fallback: generate default template
  if (!pdfDoc) {
    pdfDoc = await PDFDocument.create();
    page = pdfDoc.addPage([842, 595]);
  }

  const { width, height } = page.getSize();
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  const borderColor = rgb(0.18, 0.35, 0.58);
  const goldColor = rgb(0.85, 0.65, 0.13);
  const darkText = rgb(0.12, 0.12, 0.12);
  const whiteText = rgb(1, 1, 1);

  // If using uploaded template, ONLY overlay the student's name
  // The admin's template already has all other content (event title, dates, etc.)
  if (useUploadedTemplate) {
    // Student name only — centered, clean, no background box
    const nameSize = 28;
    const nameWidth = fontBold.widthOfTextAtSize(studentName, nameSize);
    page.drawText(studentName, {
      x: (width - nameWidth) / 2,
      y: height * 0.52,
      size: nameSize,
      font: fontBold,
      color: darkText,
    });
  } else {
    // ── Default template design ──
    // Outer border
    page.drawRectangle({ x: 20, y: 20, width: width - 40, height: height - 40, borderColor, borderWidth: 3 });
    page.drawRectangle({ x: 35, y: 35, width: width - 70, height: height - 70, borderColor: goldColor, borderWidth: 1.5 });

    // Header
    const titleText = 'CERTIFICATE OF PARTICIPATION';
    const titleSize = 28;
    const titleWidth = fontBold.widthOfTextAtSize(titleText, titleSize);
    page.drawText(titleText, {
      x: (width - titleWidth) / 2, y: height - 120, size: titleSize, font: fontBold, color: borderColor,
    });
    page.drawLine({
      start: { x: (width - titleWidth) / 2 - 10, y: height - 130 },
      end: { x: (width + titleWidth) / 2 + 10, y: height - 130 },
      thickness: 2, color: goldColor,
    });

    // Body
    const bodyStartY = height - 180;
    const presentedText = 'This certificate is proudly presented to';
    const presentedWidth = fontItalic.widthOfTextAtSize(presentedText, 14);
    page.drawText(presentedText, { x: (width - presentedWidth) / 2, y: bodyStartY, size: 14, font: fontItalic, color: darkText });

    const nameSize = 36;
    const nameWidth = fontBold.widthOfTextAtSize(studentName, nameSize);
    page.drawText(studentName, { x: (width - nameWidth) / 2, y: bodyStartY - 50, size: nameSize, font: fontBold, color: goldColor });

    const teamText = `Team: ${teamName}`;
    const teamWidth = fontRegular.widthOfTextAtSize(teamText, 14);
    page.drawText(teamText, { x: (width - teamWidth) / 2, y: bodyStartY - 85, size: 14, font: fontRegular, color: darkText });

    const forText = 'for participating in';
    const forWidth = fontItalic.widthOfTextAtSize(forText, 13);
    page.drawText(forText, { x: (width - forWidth) / 2, y: bodyStartY - 120, size: 13, font: fontItalic, color: darkText });

    const eventSize = 22;
    const eventWidth = fontBold.widthOfTextAtSize(eventTitle, eventSize);
    page.drawText(eventTitle, { x: (width - eventWidth) / 2, y: bodyStartY - 150, size: eventSize, font: fontBold, color: borderColor });

    const formattedDate = new Date(eventDate).toLocaleDateString('en-IN', { year: 'numeric', month: 'long', day: 'numeric' });
    const dateText = `held on ${formattedDate}`;
    const dateWidth = fontRegular.widthOfTextAtSize(dateText, 12);
    page.drawText(dateText, { x: (width - dateWidth) / 2, y: bodyStartY - 180, size: 12, font: fontRegular, color: darkText });

    // Footer
    page.drawLine({ start: { x: width / 2 - 100, y: 90 }, end: { x: width / 2 + 100, y: 90 }, thickness: 1, color: darkText });
    const sigText = 'Event Coordinator';
    const sigWidth = fontRegular.widthOfTextAtSize(sigText, 11);
    page.drawText(sigText, { x: (width - sigWidth) / 2, y: 72, size: 11, font: fontRegular, color: darkText });
  }

  // Save the PDF
  const pdfBytes = await pdfDoc.save();
  const outputPath = path.join(eventDir, `${studentId}.pdf`);
  fs.writeFileSync(outputPath, pdfBytes);

  return outputPath;
}

/**
 * Generate certificates for all attended teams in an event
 */
async function generateCertificatesForEvent(supabase, eventId) {
  const { data: event } = await supabase.from('events').select('*').eq('id', eventId).single();
  if (!event) throw new Error('Event not found');

  // Get ALL attended teams (allow regeneration)
  const { data: teams } = await supabase
    .from('teams')
    .select('*')
    .eq('event_id', eventId)
    .eq('attended', true);

  if (!teams || teams.length === 0) {
    return { generated: 0, message: 'No attended teams found for this event' };
  }

  const results = [];

  for (const team of teams) {
    const { data: members } = await supabase
      .from('team_members')
      .select('users(id, student_id, name)')
      .eq('team_id', team.id);

    for (const member of members || []) {
      const user = member.users;
      const certPath = await generateCertificate({
        studentName: user.name,
        teamName: team.team_name,
        eventTitle: event.title,
        eventDate: event.event_date,
        eventId,
        studentId: user.id,
        templatePath: event.certificate_template || null,
      });
      results.push({ studentId: user.student_id, name: user.name, certPath });
    }

    await supabase.from('teams').update({ certificates_generated: true }).eq('id', team.id);
  }

  return { generated: results.length, results };
}

module.exports = { generateCertificate, generateCertificatesForEvent };
