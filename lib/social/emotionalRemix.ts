export type Emotion =
  | 'funny'
  | 'uplifting'
  | 'tearjerker'
  | 'nostalgic'
  | 'empowering';

export interface Remix {
  id: string;
  sourceId: string;
  emotion: Emotion;
  caption: string;
  sound: string;
  cover: string;
}

const toneCaptions: Record<Emotion, string> = {
  funny: 'lol... life huh',
  uplifting: 'you got this ✨',
  tearjerker: 'brb crying',
  nostalgic: 'remember when...',
  empowering: 'rise up mama',
};

export function createEmotionalRemixes(sourceId: string): Remix[] {
  const tones: Emotion[] = ['funny', 'uplifting', 'tearjerker', 'nostalgic', 'empowering'];
  return tones.map((tone) => ({
    id: `${sourceId}-${tone}`,
    sourceId,
    emotion: tone,
    caption: toneCaptions[tone],
    sound: 'trending',
    cover: `/covers/${sourceId}-${tone}.jpg`,
  }));
}
