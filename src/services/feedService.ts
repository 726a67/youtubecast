import { Podcast } from 'podcast';
import { Quality } from '~/types';
import getFeedUrlParams from '~/utils/getFeedUrlParams';
import { getSourceAndVideos } from './sourceService';
import type { Video } from '~/types';

const getRssFeed = async (
  sourceId: string,
  host: string,
  quality: Quality,
  excludeShorts: boolean,
  videoServer?: string | undefined,
) => {
  const [source, allVideos] = await getSourceAndVideos(sourceId);
  const videos = allVideos
    .filter((video) => video.isAvailable && !(excludeShorts && video.isYouTubeShort))
    .sort((a, b) => (a.date < b.date ? 1 : -1));

  const videoQueryParams = new URLSearchParams();

  if (quality != Quality.Default) videoQueryParams.append('quality', quality.toString());

  if (videoServer) {
    await notifyVideoServer(videoServer, videos);
    videoQueryParams.append('videoServer', videoServer);
  }

  const feedUrlParams = getFeedUrlParams(quality, excludeShorts, videoServer);

  const rssFeed = new Podcast({
    title: source.displayName,
    description: source.description,
    author: source.displayName,
    feedUrl: `https://${host}/${sourceId}/feed${feedUrlParams}`,
    siteUrl: source.url,
    imageUrl: source.profileImageUrl.startsWith('/')
      ? `https://${host}${source.profileImageUrl}`
      : source.profileImageUrl,
  });

  videos.forEach((video) =>
    rssFeed.addItem({
      title: video.title,
      itunesTitle: video.title,
      description: video.description + '\n' + '\n' + video.url,
      date: new Date(video.date),
      enclosure: {
        url: `https://${host}/videos/${video.id}${videoQueryParams.size > 0 ? '?' : ''}${videoQueryParams.toString()}`,
        type: quality === Quality.Audio ? 'audio/aac' : 'video/mp4',
      },
      url: video.url,
      itunesDuration: video.duration,
    }),
  );

  return rssFeed.buildXml();
};

const notifyVideoServer = async (videoServer: string, videoList: Video[]) => {
  const timeout = new Promise<Response>((_, reject) =>
    setTimeout(() => reject(new Error('Video server request timed out')), 2000),
  );

  await Promise.race([
    await fetch(`https://${videoServer}`, {
      method: 'POST',
      headers: { 'Content-type': 'application/json' },
      body: JSON.stringify(videoList.map((x) => x.id)),
    }).catch((error) => console.error(error)),
    timeout,
  ]).catch((error) => console.error(error));
};

export { getRssFeed };
