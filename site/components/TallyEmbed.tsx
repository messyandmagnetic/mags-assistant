import Script from 'next/script';

interface TallyEmbedProps {
  src: string;
  title: string;
  height?: number;
}

export default function TallyEmbed({ src, title, height = 500 }: TallyEmbedProps) {
  return (
    <div className="w-full">
      <iframe
        data-tally-src={src}
        loading="lazy"
        width="100%"
        height={height}
        frameBorder="0"
        marginHeight={0}
        marginWidth={0}
        title={title}
      ></iframe>
      <Script src="https://tally.so/widgets/embed.js" />
    </div>
  );
}
