/**
 * Launch media is centralized here so every temporary sample can be replaced
 * with a Cloudflare R2 URL without touching page components.
 */
export const SHOWCASE_MEDIA = {
  homeHero: "/videos/videofly-hero-reference.mp4",
  toolExamples: [
    {
      title: "Glass strawberry",
      prompt: "A translucent glass strawberry shatters in cinematic slow motion.",
      video: "https://r2.veo3ai.io/intro/text-to-video/t2v-Glass-Strawberry-Shatters.mp4",
    },
    {
      title: "Rose bridge",
      prompt: "An anime rose blooms above a bridge at blue hour.",
      video: "https://r2.veo3ai.io/intro/text-to-video/t2v-Anime-Rose-Blooming-Bridge.mp4",
    },
    {
      title: "Moonlit dance",
      prompt: "Playful characters dance together beneath moonlight.",
      video: "https://r2.veo3ai.io/intro/text-to-video/t2v-Monkey-Seagull-Moonlit-Dance.mp4",
    },
    {
      title: "Butterfly garden",
      prompt: "A monarch butterfly rests on flowers in a soft breeze.",
      video: "https://r2.veo3ai.io/intro/text-to-video/t2v-Monarch-Butterfly-on-Flowers.mp4",
    },
  ],
} as const;

