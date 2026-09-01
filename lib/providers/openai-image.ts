import OpenAI from "openai";

export async function generateSceneImage(prompt: string) {
  if (!process.env.OPENAI_API_KEY) return null;

  const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  try {
    const result = await client.images.generate({
      model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-2",
      prompt,
      size: "1024x1536",
    });
    const image = result.data?.[0];
    if (!image) return null;
    return {
      b64: image.b64_json ?? null,
      url: image.url ?? null,
    };
  } catch (error) {
    console.error("OpenAI scene image generation failed", error);
    return null;
  }
}
