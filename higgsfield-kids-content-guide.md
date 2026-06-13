# Higgsfield Kids Content Generation Guide

This guide teaches Claude how to generate top-performing kids content on Higgsfield AI.

---

## Character Prompts (always include)
- `big expressive cartoon eyes, friendly smile, chubby cute proportions`
- `bright saturated colors, clean outlines, Pixar-style`
- `speaks directly to camera like a kids TV host`
- `safe, warm, inviting background — classroom, kitchen, garden, forest`

---

## Style Keywords That Work
- `cheerful animated character`
- `kids educational TV style`
- `Sesame Street aesthetic`
- `bright vibrant colors`
- `fun and bouncy movement`
- `no scary elements, soft lighting`

---

## Video Settings for Kids Shorts
| Setting | Value |
|---|---|
| Aspect Ratio | `9:16` (TikTok / YouTube Shorts) |
| Duration | `5 seconds` per clip |
| Model | `kling3_0` (best for character animation) |
| Sound | `on` |

---

## Music Prompts (use `sonilo_music` model)
- `"upbeat xylophone and ukulele, kids cartoon, bouncy and happy"`
- `"cheerful educational kids TV background music, soft and playful"`
- `"fun marimba melody, preschool energy, bright and warm"`

---

## Top Topic Ideas for Kids Content
- Fruits and veggies teaching about nutrition
- Animal characters teaching letters/numbers
- Safety tips (look both ways, wash hands)
- Emotions and feelings
- Simple science facts
- Dangers of sugar / healthy eating habits

---

## Pro Tips
- Keep prompts under 50 words — cleaner output
- Always include `speaks to camera` for engagement
- Add `no text overlays` if you want clean video to add your own captions
- Generate 2-3 variations per scene and pick the best
- Use CapCut to combine video clips + background music for TikTok/Shorts
- Each 5-second clip costs ~10 credits on the Ultra plan

---

## Example Full Prompt (Talking Tomato)
```
A cute, friendly animated tomato character with big expressive eyes and a warm smile,
standing in a colorful cartoon kitchen. The tomato has little arms and legs and speaks
directly to the camera like a kids TV host. It holds up a candy bar and shakes its head
with a concerned but friendly expression. Bright vibrant colors. Fun and engaging for
young children. Vertical format for TikTok/YouTube Shorts.
```
Settings: model=`kling3_0`, aspect_ratio=`9:16`, duration=`5`, sound=`on`

---

## Workflow Summary
1. Generate video clip(s) with `generate_video` → model `kling3_0`
2. Generate background music with `generate_audio` → model `sonilo_music`
3. Combine in CapCut and export
4. Post to TikTok / YouTube Shorts
