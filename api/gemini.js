// ===================================================
// Vercel Serverless Function: Gemini API 코멘트 생성
//
// 규칙:
// - Firebase Functions가 아닌 Vercel 서버리스 함수로 동작합니다. (/api/gemini)
// - API 키는 Vercel 환경변수(process.env.GEMINI_API_KEY)에서 꺼내 씁니다.
// - 학생 식별 정보(uid, 이메일 등)는 Gemini로 전송하지 않고 메모 내용(text)만 보냅니다.
// - 무료로 사용 가능한 gemini-2.5-flash 모델을 사용합니다.
// ===================================================

export default async function handler(req, res) {
  // CORS 헤더 설정
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  if (req.method !== "POST") {
    return res.status(405).json({ error: "POST 요청만 지원합니다." });
  }

  const { text } = req.body || {};

  if (!text || typeof text !== "string" || text.trim() === "") {
    return res.status(400).json({ error: "메모 내용(text)이 필요합니다." });
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ 
      error: "서버 환경변수에 GEMINI_API_KEY가 설정되어 있지 않습니다." 
    });
  }

  try {
    // Google AI Gemini REST API 호출 (무료 티어 제공 gemini-2.5-flash)
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;

    const prompt = `당신은 친절하고 다정한 초·중등학교 선생님의 AI 도우미입니다.
학생이 우리 반 담벼락에 작성한 메모 내용을 읽고, 학생의 생각과 감정을 지지하고 격려하는 따뜻한 칭찬/피드백 코멘트를 1~2문장(한국어, 존댓말/다정한 반존댓말)으로 짧고 친근하게 작성해 주세요. 이모지도 1~2개 곁들여 주세요.

[학생의 메모 내용]
${text.trim()}`;

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              { text: prompt }
            ]
          }
        ],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 150
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return res.status(response.status).json({
        error: errorData.error?.message || "Gemini API 호출 중 오류가 발생했습니다."
      });
    }

    const data = await response.json();
    const candidateText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    const comment = candidateText ? candidateText.trim() : "좋은 생각이에요! 멋진 메모 고마워요. 👏";

    return res.status(200).json({ comment });
  } catch (err) {
    console.error("Gemini API 처리 오류:", err);
    return res.status(500).json({ error: "서버 내부 오류가 발생했습니다." });
  }
}
