// /api/run-command.js  (Vercel Serverless Function)
export default async function handler(req, res) {
  if (req.method === "GET") {
    return res.status(200).json({ ok: true, route: "/api/run-command" });
  }
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method Not Allowed" });
  }

  try {
    const { command } = req.body || { command: "(no command)" };

    const r = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are Mags. Turn user commands into short, concrete steps and respond briefly." },
          { role: "user", content: command }
        ]
      }),
    });

    const data = await r.json();
    const reply = data?.choices?.[0]?.message?.content ?? "No reply.";

    return res.status(200).json({ result: reply });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
}
