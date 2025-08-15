export function createEmotionalRemixes(sourceId) {
  const tones = ['funny', 'uplifting', 'tearjerker', 'nostalgic', 'empowering'];
  const toneCaptions = {
    funny: 'lol... life huh',
    uplifting: 'you got this ✨',
    tearjerker: 'brb crying',
    nostalgic: 'remember when...',
    empowering: 'rise up mama',
  };
  return tones.map((tone) => ({
    id: `${sourceId}-${tone}`,
    sourceId,
    emotion: tone,
    caption: toneCaptions[tone],
    sound: 'trending',
    cover: `/covers/${sourceId}-${tone}.jpg`,
  }));
}
