import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { fileBase64, mimeType } = await req.json();

    if (!fileBase64 || !mimeType) {
      return NextResponse.json({ error: 'Missing fileBase64 or mimeType' }, { status: 400 });
    }

    const geminiApiKey = process.env.GEMINI_API_KEY || '';
    if (!geminiApiKey) {
      return NextResponse.json({ error: 'Server configuration error: GEMINI_API_KEY is not set' }, { status: 500 });
    }

    // Build the prompt for Gemini 2.0 Flash
    const prompt = `You are the traffic fine statement parser for JEET ERP.
Analyze the attached RTA or Police statement (PDF, Excel, or image) and extract all traffic violations or Salik transactions.

For each fine/violation, extract details and return a strict JSON object with a "fines" array matching this schema:
{
  "fines": [
    {
      "fine_number": "String (unique reference or transaction number)",
      "fine_date": "String (YYYY-MM-DD format)",
      "fine_time": "String (HH:MM format, 24-hour, or null if not specified)",
      "location": "String (location of violation)",
      "violation_type": "String (description of the offence, e.g. Speeding, Salik Charge, Parking)",
      "amount": Number (fine/charge amount in AED)",
      "black_points": Number (integer black points or null/0 if none)",
      "source": "String (Must be DUBAI_POLICE, ABU_DHABI_POLICE, SHARJAH_POLICE, RTA, or OTHER)"
    }
  ]
}

Important rules:
- Output ONLY valid raw JSON conforming strictly to the schema above. Do not wrap in markdown code blocks, do not include preamble or text explanations.
- Parse dates to YYYY-MM-DD format. If a date is written as "10/06/2026" or "10-Jun-2026", convert it to "2026-06-10".
- Ensure the amount is extracted as a clean decimal number.
- Map the traffic authority to one of: DUBAI_POLICE, ABU_DHABI_POLICE, SHARJAH_POLICE, RTA, OTHER. For example, Salik is RTA; Dubai Police fine is DUBAI_POLICE.`;

    // Call Gemini 2.0 Flash
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${geminiApiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                { text: prompt },
                {
                  inlineData: {
                    mimeType,
                    data: fileBase64
                  }
                }
              ]
            }
          ],
          generationConfig: {
            responseMimeType: 'application/json'
          }
        })
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json({ error: `Gemini API request failed: ${errText}` }, { status: response.status });
    }

    const aiResponse = await response.json();
    const aiResultText = aiResponse.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!aiResultText) {
      return NextResponse.json({ error: 'Empty response from Gemini API' }, { status: 500 });
    }

    try {
      const parsedData = JSON.parse(aiResultText.trim());
      return NextResponse.json(parsedData);
    } catch (e: any) {
      return NextResponse.json({ 
        error: 'Failed to parse Gemini output as JSON',
        rawText: aiResultText 
      }, { status: 500 });
    }
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Internal server error' }, { status: 500 });
  }
}
