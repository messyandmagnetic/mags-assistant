export function checkSafety(text = "") {
  const warnings = [];
  const t = String(text).toLowerCase();
  if (t.includes("self-harm")) warnings.push("self-harm keyword");
  if (t.includes("shirtless minor")) warnings.push("possible inappropriate content");
  return warnings;
}
