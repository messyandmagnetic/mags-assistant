// app/api/run-command/route.js
export async function GET() {
  // health check so you can hit it in the browser and not get 404
  console.log("[Mags] GET /api/run-command hit");
  return new Response(JSON.stringify({ ok: true, route: "/api/run-command" }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}

export async function POST(req) {
  console.log("[Mags] POST /api/run-command received");
  const { command } = await req.json();
  console.log("[Mags] Command:", command);

  try {
    const resp = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4",
        messages: [
          { role: "system", content: "You are Mags. Turn user commands into short, concrete steps and respond briefly." },
          { role: "user", content: command || "(no command provided)" }
        ]
      }),
    });

    const data = await resp.json();
    const reply = data?.choices?.[0]?.message?.content ?? "No reply.";

    console.log("[Mags] Reply:", reply);

    return new Response(JSON.stringify({ result: reply }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("[Mags] Error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}
